import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { analyzeIcuMessage, compileIcuToFunction } from '../icu/compiler.js';
import { loadLocaleCatalogs, loadPoFile } from '../po/parser.js';
import type { Catalog, Message } from '../po/types.js';
import { analyzeChunksFromCatalogs } from './chunk-analysis.js';
import { generateChunkModules } from './generate-chunks.js';

export interface CompileOptions {
  /** Directory containing .po files */
  localeDir: string;
  /** Output directory for compiled translations */
  outputDir: string;
  /** Default/source locale */
  defaultLocale: string;
  /**
   * Enable Suspense-based lazy loading.
   * When true, generates chunk files for dynamic imports.
   * @default false
   */
  useSuspense?: boolean;
  /** List of supported locales (required when useSuspense is true) */
  locales?: string[];
  /** Project root for computing chunk IDs (required when useSuspense is true) */
  projectRoot?: string;
}

export interface CompiledMessage {
  /** The message key */
  key: string;
  /** Translations by locale (string or compiled function as string) */
  translations: Record<string, string>;
  /** Whether this message has ICU formatting (needs function compilation) */
  isIcu: boolean;
  /** Variable names used in the message */
  variables: string[];
  /** Number of component tags (<0>...</0>, <1>...</1>, etc.) */
  componentCount: number;
  /** Optional namespace */
  namespace?: string;
}

/**
 * Count component tags in a message (e.g., <0>...</0>, <1>...</1>).
 * Returns the count of unique tags (max index + 1).
 */
function countComponentTags(source: string): number {
  const tagRegex = /<(\d+)>/g;
  let maxIndex = -1;
  let match;
  while ((match = tagRegex.exec(source)) !== null) {
    const index = parseInt(match[1]!, 10);
    maxIndex = Math.max(maxIndex, index);
  }
  return maxIndex + 1;
}

/**
 * Compile PO files to JavaScript/TypeScript output.
 *
 * Creates:
 * - translations.js: Compiled translation data
 * - types.ts: TypeScript type definitions
 * - index.ts: Re-exports with typed factories
 *
 * When useSuspense is true, also creates:
 * - chunks/: Per-chunk, per-locale translation files
 * - manifest.json: Chunk ID to source file mapping
 */
export async function compileTranslations(
  options: CompileOptions,
): Promise<void> {
  const {
    localeDir,
    outputDir,
    defaultLocale,
    useSuspense,
    locales,
    projectRoot,
  } = options;

  // Ensure output directories exist
  await fs.mkdir(outputDir, { recursive: true });
  const generatedDir = join(outputDir, '.generated');
  await fs.mkdir(generatedDir, { recursive: true });

  // Detect all locales (from flat .po files and namespace directories)
  const files = await fs.readdir(localeDir);
  const detectedLocales = new Set<string>();

  for (const file of files) {
    if (file.endsWith('.po')) {
      // Flat PO file: {locale}.po
      detectedLocales.add(basename(file, '.po'));
    } else {
      // Check if it's a directory (namespace directory)
      const stat = await fs.stat(join(localeDir, file)).catch(() => null);
      if (stat?.isDirectory()) {
        detectedLocales.add(file);
      }
    }
  }

  if (detectedLocales.size === 0) {
    throw new Error(`No .po files or locale directories found in ${localeDir}`);
  }

  // Load all catalogs (both flat and namespaced)
  // Structure: locale -> (namespace | undefined) -> Catalog
  const allCatalogs = new Map<string, Map<string | undefined, Catalog>>();
  const detectedNamespaces = new Set<string>();

  for (const locale of detectedLocales) {
    const localeCatalogs = await loadLocaleCatalogs(localeDir, locale);
    allCatalogs.set(locale, localeCatalogs);

    // Track namespaces
    for (const ns of localeCatalogs.keys()) {
      if (ns !== undefined) {
        detectedNamespaces.add(ns);
      }
    }
  }

  // For backwards compatibility, also create a flat catalog map for chunk analysis
  const catalogs = new Map<string, Catalog>();
  for (const [locale, nsCatalogs] of allCatalogs) {
    // Merge all catalogs for a locale into one for chunk analysis
    const mergedCatalog: Catalog = {
      locale,
      messages: new Map(),
      headers: {},
    };
    for (const [, catalog] of nsCatalogs) {
      for (const [key, msg] of catalog.messages) {
        mergedCatalog.messages.set(key, msg);
      }
    }
    catalogs.set(locale, mergedCatalog);
  }

  // Collect all unique message keys across catalogs
  // Key format: {namespace}:{key} or just {key} for non-namespaced
  const allMessages = new Map<string, CompiledMessage>();

  for (const [locale, nsCatalogs] of allCatalogs) {
    for (const [namespace, catalog] of nsCatalogs) {
      for (const [key, message] of catalog.messages) {
        // Create a unique composite key for internal tracking
        const compositeKey = namespace ? `${namespace}:${key}` : key;

        if (!allMessages.has(compositeKey)) {
          const analysis = analyzeIcuMessage(message.source);
          allMessages.set(compositeKey, {
            key,
            translations: {},
            isIcu: analysis.hasPlural || analysis.hasSelect,
            variables: analysis.variables,
            componentCount: countComponentTags(message.source),
            namespace,
          });
        }

        const compiled = allMessages.get(compositeKey)!;

        // Compile the translation
        if (message.translation) {
          if (compiled.isIcu || message.flags?.includes('icu-format')) {
            // Compile ICU to function string
            compiled.translations[locale] = compileIcuToFunctionString(
              message.translation,
              locale,
            );
            compiled.isIcu = true;
          } else {
            compiled.translations[locale] = message.translation;
          }
        }
      }
    }
  }

  // Generate internal files to .generated/
  await generateTranslationsJs(generatedDir, allMessages);
  await generateTypesTs(generatedDir, allMessages, [...catalogs.keys()]);

  // Generate suspense-specific files or standard index
  if (useSuspense && locales && projectRoot) {
    // Analyze chunks from catalog references
    const chunkAnalysis = analyzeChunksFromCatalogs(catalogs, projectRoot);

    // Generate chunk files to .generated/
    await generateChunkModules({
      outputDir: generatedDir,
      locales,
      analysis: chunkAnalysis,
      catalogs,
    });

    // Generate suspense-aware index.ts (user-facing, at outputDir root)
    await generateIndexTsSuspense(outputDir, locales);
  } else {
    // Generate standard index.ts (user-facing, at outputDir root)
    await generateIndexTs(outputDir);
  }

  // Generate plain.ts for imperative translation (user-facing, at outputDir root)
  await generatePlainTs(outputDir);
}

/**
 * Compile ICU message to a function string (for inline in JS)
 */
function compileIcuToFunctionString(message: string, locale: string): string {
  // For now, we'll inline the ICU runtime
  // In production, this would be optimized to conditionals
  const analysis = analyzeIcuMessage(message);

  if (!analysis.hasPlural && !analysis.hasSelect) {
    // Simple string with placeholders - use template literal
    return message.replace(/\{([^}]+)\}/g, '${args.$1}');
  }

  // For ICU with plural/select, generate a function
  // This is a simplified version - full implementation would use the ICU compiler
  return `(args) => {
    const pr = new Intl.PluralRules('${locale}')
    ${generatePluralFunction(message, analysis.variables)}
  }`;
}

function generatePluralFunction(message: string, variables: string[]): string {
  // Simplified plural function generation
  // Full implementation would parse the ICU and generate optimal code
  return `return ${JSON.stringify(message)}.replace(/{(\\w+)}/g, (_, k) => args[k] || '')`;
}

async function generateTranslationsJs(
  outputDir: string,
  messages: Map<string, CompiledMessage>,
): Promise<void> {
  let content = '// Auto-generated by @idioma/core\n';
  content += '// Do not edit directly\n\n';
  content += 'export const translations = {\n';

  // Separate messages by namespace
  const nonNamespaced: CompiledMessage[] = [];
  const byNamespace = new Map<string, CompiledMessage[]>();

  for (const [, msg] of messages) {
    if (msg.namespace) {
      if (!byNamespace.has(msg.namespace)) {
        byNamespace.set(msg.namespace, []);
      }
      byNamespace.get(msg.namespace)!.push(msg);
    } else {
      nonNamespaced.push(msg);
    }
  }

  // Output non-namespaced messages at top level
  for (const msg of nonNamespaced) {
    content += `  ${JSON.stringify(msg.key)}: {\n`;
    for (const [locale, translation] of Object.entries(msg.translations)) {
      if (msg.isIcu && translation.startsWith('(args)')) {
        content += `    ${JSON.stringify(locale)}: ${translation},\n`;
      } else {
        content += `    ${JSON.stringify(locale)}: ${JSON.stringify(translation)},\n`;
      }
    }
    content += '  },\n';
  }

  // Output namespaced messages under __ns
  if (byNamespace.size > 0) {
    content += '  __ns: {\n';
    for (const [namespace, msgs] of byNamespace) {
      content += `    ${JSON.stringify(namespace)}: {\n`;
      for (const msg of msgs) {
        content += `      ${JSON.stringify(msg.key)}: {\n`;
        for (const [locale, translation] of Object.entries(msg.translations)) {
          if (msg.isIcu && translation.startsWith('(args)')) {
            content += `        ${JSON.stringify(locale)}: ${translation},\n`;
          } else {
            content += `        ${JSON.stringify(locale)}: ${JSON.stringify(translation)},\n`;
          }
        }
        content += '      },\n';
      }
      content += '    },\n';
    }
    content += '  },\n';
  }

  content += '};\n';

  await fs.writeFile(join(outputDir, 'translations.js'), content, 'utf-8');
}

async function generateTypesTs(
  outputDir: string,
  messages: Map<string, CompiledMessage>,
  locales: string[],
): Promise<void> {
  let content = '// Auto-generated by @idioma/core\n';
  content += '// Do not edit directly\n\n';
  content += "import type { ComponentType, ReactNode } from 'react';\n\n";

  // TransComponent type (for component interpolation)
  content +=
    'export type TransComponent = ComponentType<{ children?: ReactNode }>;\n\n';

  // Generate Locale type
  content += `export type Locale = ${locales.map((l) => JSON.stringify(l)).join(' | ')};\n\n`;

  // Generate TranslationKey type
  const keys = [...messages.keys()];
  content += `export type TranslationKey = ${keys.map((k) => JSON.stringify(k)).join(' | ') || 'never'};\n\n`;

  // Generate MessageValues interface (all keys, empty object for no variables)
  // Index signature required for compatibility with Record<string, Record<string, unknown>> constraint
  content += 'export interface MessageValues {\n';
  content += '  [key: string]: Record<string, unknown>;\n';
  for (const [key, msg] of messages) {
    if (msg.variables.length > 0) {
      const entries = msg.variables
        .map((v) => `${quoteIfNeeded(v)}: string | number`)
        .join('; ');
      content += `  ${JSON.stringify(key)}: { ${entries} };\n`;
    } else {
      content += `  ${JSON.stringify(key)}: Record<string, never>;\n`;
    }
  }
  content += '}\n\n';

  // Generate MessageComponents interface
  // Index signature required for compatibility with Record<string, TransComponent[]> constraint
  content += 'export interface MessageComponents {\n';
  content += '  [key: string]: TransComponent[];\n';
  for (const [key, msg] of messages) {
    if (msg.componentCount > 0) {
      const tuple = Array(msg.componentCount).fill('TransComponent').join(', ');
      content += `  ${JSON.stringify(key)}: [${tuple}];\n`;
    } else {
      content += `  ${JSON.stringify(key)}: [];\n`;
    }
  }
  content += '}\n\n';

  // Generate StringOnlyKey type (messages without component tags - can use useT)
  const stringOnlyKeys = [...messages.entries()]
    .filter(([, m]) => m.componentCount === 0)
    .map(([k]) => k);

  content += `export type StringOnlyKey = ${stringOnlyKeys.map((k) => JSON.stringify(k)).join(' | ') || 'never'};\n`;

  await fs.writeFile(join(outputDir, 'types.ts'), content, 'utf-8');
}

/**
 * Quote a variable name if it contains special characters.
 */
function quoteIfNeeded(name: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return name;
  }
  return JSON.stringify(name);
}

async function generateIndexTs(outputDir: string): Promise<void> {
  const content = `// Auto-generated by @idioma/core
// Do not edit directly

import {
  createIdiomaProvider,
  createTrans,
  createUseLocale,
  createUseT,
  Plural,
  plural,
} from '@idioma/react';
import { translations } from './.generated/translations.js';
import type {
  Locale,
  MessageComponents,
  MessageValues,
  StringOnlyKey,
  TranslationKey,
} from './.generated/types';

export const Trans = createTrans<TranslationKey, MessageValues, MessageComponents>(translations);
export const useT = createUseT<StringOnlyKey, MessageValues>(translations);
export const IdiomaProvider = createIdiomaProvider();
export const useLocale = createUseLocale();

export { Plural, plural };
export type {
  Locale,
  MessageComponents,
  MessageValues,
  StringOnlyKey,
  TranslationKey,
};
`;

  await fs.writeFile(join(outputDir, 'index.ts'), content, 'utf-8');
}

async function generateIndexTsSuspense(
  outputDir: string,
  locales: string[],
): Promise<void> {
  const content = `// Auto-generated by @idioma/core
// Do not edit directly

import {
  createIdiomaProvider,
  createTrans,
  createUseLocale,
  createUseT,
} from '@idioma/react/runtime-suspense';
import type {
  Locale,
  MessageComponents,
  MessageValues,
  StringOnlyKey,
  TranslationKey,
} from './.generated/types';

const config = {
  locales: ${JSON.stringify(locales)} as const,
};

export const Trans = createTrans<TranslationKey, MessageValues, MessageComponents>(config);
export const useT = createUseT<StringOnlyKey, MessageValues>(config);
export const IdiomaProvider = createIdiomaProvider();
export const useLocale = createUseLocale();

export type {
  Locale,
  MessageComponents,
  MessageValues,
  StringOnlyKey,
  TranslationKey,
};
`;

  await fs.writeFile(join(outputDir, 'index.ts'), content, 'utf-8');
}

async function generatePlainTs(outputDir: string): Promise<void> {
  const content = `// Auto-generated by @idioma/core
// Do not edit directly
// Plain JavaScript translation utilities (no React dependency)

import type { StringOnlyKey, MessageValues } from './.generated/types';

// Re-export createT from runtime.
// In production, Babel inlines translations at each call site.
// For dynamic strings, Babel injects the translations import automatically.
export { createT } from '@idioma/core/runtime';

export type { StringOnlyKey, MessageValues };
`;

  await fs.writeFile(join(outputDir, 'plain.ts'), content, 'utf-8');
}
