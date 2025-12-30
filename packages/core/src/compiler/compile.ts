import { promises as fs } from 'fs';
import { basename, join } from 'path';
import {
  parse,
  TYPE,
  type LiteralElement,
  type MessageFormatElement,
  type PluralElement,
  type PluralOrSelectOption,
  type SelectElement,
} from '@formatjs/icu-messageformat-parser';
import type { Framework } from '../framework.js';
import { isTanStackFramework } from '../framework.js';
import { analyzeIcuMessage, type IcuAnalysis } from '../icu/compiler.js';
import { loadLocaleCatalogs } from '../po/parser.js';
import type { Catalog, Message } from '../po/types.js';
import {
  compileRoutes,
  extractRoutes,
  generateRoutesModule,
  generateRoutesTypes,
  ROUTE_CONTEXT_PREFIX,
} from '../routes/index.js';
import { analyzeChunksFromCatalogs } from './chunk-analysis.js';
import { generateChunkModules } from './generate-chunks.js';
import {
  generateConfigModule,
  generateConfigTypes,
  type DetectionOptions,
} from './generate-config.js';

/**
 * Creates a compilation lock to prevent concurrent compilations.
 * This prevents race conditions when multiple processes try to
 * clean and regenerate the .generated directory simultaneously.
 */
export interface CompileLock {
  /** Compile with lock protection */
  compile(options: CompileOptions): Promise<void>;
}

/**
 * Creates a compile lock that serializes compilation calls.
 * When multiple compilations are requested concurrently, they are
 * queued and executed one at a time to prevent race conditions.
 */
export function createCompileLock(): CompileLock {
  let currentCompilation: Promise<void> | null = null;

  return {
    async compile(options: CompileOptions): Promise<void> {
      // Wait for any in-progress compilation to complete
      while (currentCompilation) {
        await currentCompilation;
      }

      // Start new compilation and track it
      currentCompilation = compileTranslations(options).finally(() => {
        currentCompilation = null;
      });

      await currentCompilation;
    },
  };
}

/** Routing options for Link component generation */
export interface RoutingCompileOptions {
  /** Whether routing is enabled */
  enabled: boolean;
  /** Whether localized paths are enabled (routes will be imported) */
  localizedPaths: boolean;
  /** Detected framework for determining which Link package to use */
  framework: Framework;
  /** Base URL for absolute hreflang links and canonical URLs (optional) */
  metadataBase?: string;
  /** Locale prefix strategy for URLs */
  prefixStrategy?: 'always' | 'as-needed' | 'never';
  /** Locale detection settings */
  detection?: DetectionOptions;
}

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
  /** Routing options for Link component generation */
  routing?: RoutingCompileOptions;
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
  /** Cached ICU analysis (avoids re-parsing) */
  icuAnalysis?: IcuAnalysis;
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
 * - translations.ts: Compiled translation data
 * - types.d.ts: TypeScript type definitions
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
    routing,
  } = options;

  // Ensure output directories exist (don't delete - overwrite in place)
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
          // Use the translation (not source which is just a hash key) for analysis
          const translationText = message.translation || '';
          const hasComponentTags = /<\d+>/.test(translationText);

          // Skip ICU analysis if message has component tags (they break the ICU parser)
          let analysis: IcuAnalysis = {
            hasPlaceholders: false,
            hasPlural: false,
            hasSelect: false,
            variables: [],
          };
          if (!hasComponentTags && translationText) {
            try {
              analysis = analyzeIcuMessage(translationText);
            } catch {
              // If parsing fails, treat as non-ICU message
            }
          }

          allMessages.set(compositeKey, {
            key,
            translations: {},
            isIcu: analysis.hasPlural || analysis.hasSelect,
            variables: analysis.variables,
            componentCount: countComponentTags(translationText),
            namespace,
            // Cache analysis for reuse across locales
            icuAnalysis:
              !hasComponentTags && translationText ? analysis : undefined,
          });
        }

        const compiled = allMessages.get(compositeKey)!;

        // Compile the translation
        if (message.translation) {
          // Skip ICU analysis for messages with component tags (they break the parser)
          const hasComponentTags = /<\d+>/.test(message.translation);

          if (hasComponentTags) {
            // Messages with component tags are handled differently - just store as string
            compiled.translations[locale] = message.translation;
          } else {
            // Use cached analysis if available, otherwise analyze
            const analysis =
              compiled.icuAnalysis ?? analyzeIcuMessage(message.translation);
            const hasIcu =
              analysis.hasPlural ||
              analysis.hasSelect ||
              message.flags?.includes('icu-format');

            if (hasIcu) {
              // Compile ICU to function string, passing cached analysis
              compiled.translations[locale] = compileIcuToFunctionString(
                message.translation,
                locale,
                analysis,
              );
              compiled.isIcu = true;
            } else {
              compiled.translations[locale] = message.translation;
            }
          }
        }
      }
    }
  }

  // Generate internal files to .generated/
  await generateTranslationsJs(generatedDir, allMessages);
  await generateTypesTs(generatedDir, allMessages, [...catalogs.keys()]);

  // Generate routes if localizedPaths is enabled
  if (routing?.localizedPaths && routing.framework && projectRoot) {
    const extractedRoutes = await extractRoutes(projectRoot, routing.framework);
    const routeMessages = extractRouteMessagesFromCatalogs(catalogs, [
      ...detectedLocales,
    ]);
    const compiledRoutes = compileRoutes(
      extractedRoutes,
      routeMessages,
      [...detectedLocales],
      routing.framework,
    );

    await fs.writeFile(
      join(generatedDir, 'routes.js'),
      generateRoutesModule(compiledRoutes),
    );
    await fs.writeFile(
      join(generatedDir, 'routes.d.ts'),
      generateRoutesTypes([...detectedLocales]),
    );
  }

  // Always generate config files (locales/defaultLocale are always re-exported from index.ts)
  {
    const allLocales = locales ?? [...detectedLocales];
    const configOptions = {
      locales: allLocales,
      defaultLocale,
      prefixStrategy: routing?.prefixStrategy,
      detection: routing?.detection,
      metadataBase: routing?.metadataBase,
    };

    await fs.writeFile(
      join(generatedDir, 'config.js'),
      generateConfigModule(configOptions),
    );
    await fs.writeFile(
      join(generatedDir, 'config.d.ts'),
      generateConfigTypes(configOptions),
    );
  }

  // Ensure we have locales for code generation
  const allLocales = locales ?? [...detectedLocales];

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
    await generateIndexTsSuspense({
      outputDir,
      locales: allLocales,
      defaultLocale,
      routing,
    });
  } else {
    // Generate standard index.ts (user-facing, at outputDir root)
    await generateIndexTs({
      outputDir,
      locales: allLocales,
      defaultLocale,
      routing,
    });
  }

  // Generate plain.ts for imperative translation (user-facing, at outputDir root)
  await generatePlainTs(outputDir);
}

/**
 * Extract route messages from catalogs for route compilation.
 * Filters messages that have the route: context prefix.
 */
function extractRouteMessagesFromCatalogs(
  catalogs: Map<string, Catalog>,
  locales: string[],
): Record<string, Message[]> {
  const result: Record<string, Message[]> = {};
  for (const locale of locales) {
    const catalog = catalogs.get(locale);
    if (catalog) {
      result[locale] = [...catalog.messages.values()].filter((m) =>
        m.context?.startsWith(ROUTE_CONTEXT_PREFIX),
      );
    }
  }
  return result;
}

/**
 * Compile ICU message to a JavaScript function string (for inline in JS).
 * This generates actual executable JavaScript code that evaluates the ICU message.
 * Exported for use in chunk generation (Suspense mode).
 *
 * @param message - The ICU message string to compile
 * @param locale - The target locale
 * @param cachedAnalysis - Optional pre-computed analysis to avoid re-parsing
 */
export function compileIcuToFunctionString(
  message: string,
  locale: string,
  cachedAnalysis?: IcuAnalysis,
): string {
  const analysis = cachedAnalysis ?? analyzeIcuMessage(message);

  if (!analysis.hasPlural && !analysis.hasSelect) {
    // Simple string with placeholders - use template literal
    // Escape backticks and ${} in the message
    const escaped = message
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
    // Replace {varName} with ${args.varName}
    const template = escaped.replace(/\{([^}]+)\}/g, '${args.$1}');
    return `\`${template}\``;
  }

  // Parse the ICU message and generate JavaScript code
  const ast = parse(message);
  const body = generateCodeForElements(ast, locale);

  return `(args) => { ${body} }`;
}

/**
 * Generate JavaScript code for a list of message format elements.
 * Returns code that evaluates to a string.
 */
function generateCodeForElements(
  elements: MessageFormatElement[],
  locale: string,
  pluralValueExpr?: string,
): string {
  const parts: string[] = [];

  for (const el of elements) {
    switch (el.type) {
      case TYPE.literal:
        parts.push(JSON.stringify((el as LiteralElement).value));
        break;

      case TYPE.argument:
        parts.push(`String(args.${el.value} ?? '')`);
        break;

      case TYPE.plural:
        parts.push(generatePluralCode(el as PluralElement, locale));
        break;

      case TYPE.select:
        parts.push(generateSelectCode(el as SelectElement, locale));
        break;

      case TYPE.pound:
        // # in plural - use the plural value expression
        if (pluralValueExpr) {
          parts.push(`String(${pluralValueExpr})`);
        }
        break;

      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        parts.push(`String(args.${el.value} ?? '')`);
        break;
    }
  }

  if (parts.length === 0) {
    return "return ''";
  }
  if (parts.length === 1) {
    return `return ${parts[0]}`;
  }
  return `return ${parts.join(' + ')}`;
}

/**
 * Generate JavaScript code for a plural element.
 * Uses Intl.PluralRules for CLDR-compliant plural selection.
 */
function generatePluralCode(el: PluralElement, locale: string): string {
  const varName = el.value;
  const offset = el.offset || 0;

  // Generate an IIFE that handles plural logic
  let code = `((v) => { `;

  // Apply offset if present
  if (offset !== 0) {
    code += `const av = v - ${offset}; `;
  } else {
    code += `const av = v; `;
  }

  // Check for exact matches first (=0, =1, etc.)
  const exactMatches: [number, PluralOrSelectOption][] = [];
  const categoryMatches: [string, PluralOrSelectOption][] = [];

  for (const [key, option] of Object.entries(el.options)) {
    if (key.startsWith('=')) {
      const exactValue = parseInt(key.slice(1), 10);
      exactMatches.push([exactValue, option]);
    } else {
      categoryMatches.push([key, option]);
    }
  }

  // Generate exact match checks
  for (const [value, option] of exactMatches) {
    const optionCode = generateCodeForOption(option, locale, 'av');
    code += `if (v === ${value}) { ${optionCode} } `;
  }

  // Special handling for zero category when value is 0
  const zeroOption = el.options.zero;
  if (zeroOption && !exactMatches.some(([v]) => v === 0)) {
    const optionCode = generateCodeForOption(zeroOption, locale, 'av');
    code += `if (v === 0) { ${optionCode} } `;
  }

  // Use Intl.PluralRules for category matching
  code += `const pr = new Intl.PluralRules('${locale}'); `;
  code += `const cat = pr.select(av); `;

  // Generate category matches (skip 'zero' as we handled it above)
  const categories = ['one', 'two', 'few', 'many', 'other'];
  let hasOtherCase = false;
  for (const cat of categories) {
    const option = el.options[cat];
    if (option) {
      const optionCode = generateCodeForOption(option, locale, 'av');
      if (cat === 'other') {
        // 'other' is the fallback - it always matches so no if needed
        code += `${optionCode} `;
        hasOtherCase = true;
      } else {
        code += `if (cat === '${cat}') { ${optionCode} } `;
      }
    }
  }

  // Only add fallback if there's no 'other' case
  if (!hasOtherCase) {
    code += `return ''; `;
  }
  code += `})(Number(args.${varName}))`;

  return code;
}

/**
 * Generate code for a plural/select option (the content inside one/other/etc.)
 * Handles # (pound) substitution for plural values when valueExpr is provided.
 */
function generateCodeForOption(
  option: PluralOrSelectOption,
  locale: string,
  valueExpr?: string,
): string {
  const parts: string[] = [];

  for (const el of option.value) {
    switch (el.type) {
      case TYPE.literal:
        parts.push(JSON.stringify((el as LiteralElement).value));
        break;
      case TYPE.argument:
        parts.push(`String(args.${el.value} ?? '')`);
        break;
      case TYPE.pound:
        // # in plural - substitute with the plural value
        if (valueExpr) {
          parts.push(`String(${valueExpr})`);
        }
        break;
      case TYPE.plural:
        parts.push(generatePluralCode(el as PluralElement, locale));
        break;
      case TYPE.select:
        parts.push(generateSelectCode(el as SelectElement, locale));
        break;
      default:
        parts.push(`String(args.${(el as { value: string }).value} ?? '')`);
        break;
    }
  }

  if (parts.length === 0) {
    return "return ''";
  }
  if (parts.length === 1) {
    return `return ${parts[0]}`;
  }
  return `return ${parts.join(' + ')}`;
}

/**
 * Generate JavaScript code for a select element.
 */
function generateSelectCode(el: SelectElement, locale: string): string {
  const varName = el.value;

  let code = `((sv) => { `;

  // Generate case matches
  for (const [key, option] of Object.entries(el.options)) {
    if (key === 'other') continue; // Handle 'other' as fallback

    const optionCode = generateCodeForOption(option, locale);
    code += `if (sv === '${key}') { ${optionCode} } `;
  }

  // 'other' is the fallback
  const otherOption = el.options.other;
  if (otherOption) {
    const optionCode = generateCodeForOption(otherOption, locale);
    code += `${optionCode} `;
  } else {
    // Only add fallback if there's no 'other' case
    code += `return ''; `;
  }
  code += `})(String(args.${varName} ?? ''))`;

  return code;
}

async function generateTranslationsJs(
  outputDir: string,
  messages: Map<string, CompiledMessage>,
): Promise<void> {
  let content = '// Auto-generated by @idiomi/core\n';
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
      if (msg.isIcu && translation.startsWith('(args')) {
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
          if (msg.isIcu && translation.startsWith('(args')) {
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

  // Write .js for runtime/bundler (Vite loads this at build time for Babel)
  // No .d.ts needed since user code doesn't import translations.js directly
  await fs.writeFile(join(outputDir, 'translations.js'), content, 'utf-8');
}

async function generateTypesTs(
  outputDir: string,
  messages: Map<string, CompiledMessage>,
  locales: string[],
): Promise<void> {
  let content = '// Auto-generated by @idiomi/core\n';
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

  // Generate IdiomiTypes - bundles all types for cleaner factory API
  content += '/** Combined types for createTrans/createUseT factories */\n';
  content += 'export interface IdiomiTypes {\n';
  content += '  TranslationKey: TranslationKey;\n';
  content += '  MessageValues: MessageValues;\n';
  content += '  MessageComponents: MessageComponents;\n';
  content += '}\n';

  await fs.writeFile(join(outputDir, 'types.d.ts'), content, 'utf-8');
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

/**
 * Get the package import path for Link/LocaleHead based on framework.
 * Note: TanStack uses native Link, but we still need this for LocaleHead.
 */
function getLinkPackage(framework: Framework): string | null {
  switch (framework) {
    case 'next-app':
      return '@idiomi/next';
    case 'next-pages':
      return '@idiomi/next/pages';
    case 'tanstack':
    case 'tanstack-start':
      return '@idiomi/tanstack-react';
    default:
      return null;
  }
}

/**
 * Get the package import path for createLocaleLoader based on framework.
 * TanStack Start uses SSR-aware version from /start subpath.
 */
function getLocaleLoaderPackage(framework: Framework): string | null {
  switch (framework) {
    case 'tanstack':
      return '@idiomi/tanstack-react';
    case 'tanstack-start':
      return '@idiomi/tanstack-react/start';
    default:
      return null;
  }
}

/** Options for generating route-aware code */
interface RouteAwareCodeOptions {
  routing: RoutingCompileOptions;
  locales: string[];
  defaultLocale: string;
}

/**
 * Generate all route-aware code for index.ts (Link, LocaleHead, createMiddleware, etc.)
 */
function generateRouteAwareCode(options: RouteAwareCodeOptions): string {
  const { routing, locales, defaultLocale } = options;
  const pkg = getLinkPackage(routing.framework);
  if (!pkg) return '';

  const imports: string[] = [];
  const exports: string[] = [];
  const isNextJs =
    routing.framework === 'next-app' || routing.framework === 'next-pages';
  const isTanStack = isTanStackFramework(routing.framework);
  const localeLoaderPkg = getLocaleLoaderPackage(routing.framework);

  if (routing.localizedPaths) {
    // Import routes for LocaleHead and URL rewriting
    // routePatterns is used for segment-level matching with dynamic params
    imports.push(
      `import { routes, reverseRoutes, routePatterns } from './.generated/routes';`,
    );
    // Import config values for middleware
    const configImports = [
      'locales',
      'defaultLocale',
      'prefixStrategy',
      'detection',
    ];
    if (routing.metadataBase) {
      configImports.push('metadataBase');
    }
    imports.push(
      `import { ${configImports.join(', ')} } from './.generated/config';`,
    );

    // TanStack: Users use TanStack's native Link with URL rewriting - no createLink
    // Next.js: Still uses createLink for backward compatibility
    if (isNextJs) {
      imports.push(`import { createLink, createLocaleHead } from '${pkg}';`);
      imports.push(
        `import { createMiddlewareFactory } from '@idiomi/next/middleware';`,
      );
    } else if (isTanStack && localeLoaderPkg) {
      // TanStack uses factories for locale detection and URL rewriting
      // createLocaleHead and createUrlRewriter always come from the base package
      imports.push(
        `import { createLocaleHead, createUrlRewriter } from '${pkg}';`,
      );
      // createLocaleLoader comes from /start for TanStack Start (SSR-aware)
      imports.push(`import { createLocaleLoader } from '${localeLoaderPkg}';`);
    }

    exports.push('');

    // Generate Link with config (Next.js only - TanStack uses native Link)
    if (isNextJs) {
      exports.push('export const Link = createLink({');
      exports.push('  routes,');
      exports.push('  defaultLocale,');
      exports.push('  prefixStrategy,');
      exports.push('});');
      exports.push('');
    }

    // Generate LocaleHead with config (uses imported variables from .generated/config)
    const localeHeadConfig: string[] = [];
    if (routing.metadataBase) {
      localeHeadConfig.push(`  metadataBase,`);
    }
    localeHeadConfig.push(`  locales,`);
    localeHeadConfig.push(`  defaultLocale,`);
    localeHeadConfig.push(`  routes,`);
    localeHeadConfig.push(`  reverseRoutes,`);
    localeHeadConfig.push(`  prefixStrategy,`);

    exports.push(`export const LocaleHead = createLocaleHead({`);
    exports.push(...localeHeadConfig);
    exports.push(`});`);
    exports.push('');

    // Generate createMiddleware factory for Next.js (uses imported variables from .generated/config)
    if (isNextJs) {
      exports.push(`export const createMiddleware = createMiddlewareFactory({`);
      exports.push(`  locales,`);
      exports.push(`  defaultLocale,`);
      exports.push(`  routes,`);
      exports.push(`  reverseRoutes,`);
      exports.push(`});`);
      exports.push('');
    }

    // Generate TanStack SPA functions using factories (browser-safe, no SSR deps)
    // Note: createMiddleware is NOT generated here to avoid @tanstack/react-start deps
    // For TanStack Start SSR, users should create middleware manually
    if (isTanStack) {
      exports.push(
        `export const { localeLoader, detectClientLocale } = createLocaleLoader<Locale>({`,
      );
      exports.push(`  locales,`);
      exports.push(`  defaultLocale,`);
      exports.push(`  prefixStrategy,`);
      exports.push(`  detection,`);
      exports.push(`});`);
      exports.push('');
      exports.push(
        `export const { deLocalizeUrl, localizeUrl } = createUrlRewriter<Locale>({`,
      );
      exports.push(`  locales,`);
      exports.push(`  defaultLocale,`);
      exports.push(`  prefixStrategy,`);
      exports.push(`  routes,`);
      exports.push(`  reverseRoutes,`);
      exports.push(`  routePatterns,`);
      exports.push(`});`);
      exports.push('');
    }

    // Re-export getLocaleHead for programmatic use
    exports.push(`export { getLocaleHead } from '@idiomi/react';`);
  } else {
    // Routing enabled but no path translation - still need locale prefix support
    const configImports = [
      'locales',
      'defaultLocale',
      'prefixStrategy',
      'detection',
    ];
    if (routing.metadataBase) {
      configImports.push('metadataBase');
    }
    imports.push(
      `import { ${configImports.join(', ')} } from './.generated/config';`,
    );

    // TanStack: Users use TanStack's native Link - no createLink
    // Next.js: Still uses createLink for backward compatibility
    if (isNextJs) {
      imports.push(`import { createLink, createLocaleHead } from '${pkg}';`);
    } else if (isTanStack && localeLoaderPkg) {
      // TanStack uses factories for locale detection and URL rewriting
      // createLocaleHead and createPrefixOnlyRewriter always come from the base package
      imports.push(
        `import { createLocaleHead, createPrefixOnlyRewriter } from '${pkg}';`,
      );
      // createLocaleLoader comes from /start for TanStack Start (SSR-aware)
      imports.push(`import { createLocaleLoader } from '${localeLoaderPkg}';`);
    }

    exports.push('');

    // Generate Link with config but without routes (Next.js only - TanStack uses native Link)
    if (isNextJs) {
      exports.push('export const Link = createLink({');
      exports.push('  defaultLocale,');
      exports.push('  prefixStrategy,');
      exports.push('});');
      exports.push('');
    }

    // Generate LocaleHead with config but without routes (uses imported variables from .generated/config)
    const localeHeadConfig: string[] = [];
    if (routing.metadataBase) {
      localeHeadConfig.push(`  metadataBase,`);
    }
    localeHeadConfig.push(`  locales,`);
    localeHeadConfig.push(`  defaultLocale,`);
    localeHeadConfig.push(`  prefixStrategy,`);

    exports.push(`export const LocaleHead = createLocaleHead({`);
    exports.push(...localeHeadConfig);
    exports.push(`});`);
    exports.push('');

    // Generate TanStack SPA functions using factories
    if (isTanStack) {
      exports.push(
        `export const { localeLoader, detectClientLocale } = createLocaleLoader<Locale>({`,
      );
      exports.push(`  locales,`);
      exports.push(`  defaultLocale,`);
      exports.push(`  prefixStrategy,`);
      exports.push(`  detection,`);
      exports.push(`});`);
      exports.push('');
      exports.push(
        `export const { localizeUrl } = createPrefixOnlyRewriter<Locale>({`,
      );
      exports.push(`  locales,`);
      exports.push(`  defaultLocale,`);
      exports.push(`  prefixStrategy,`);
      exports.push(`});`);
      exports.push('');
    }

    // Re-export getLocaleHead for programmatic use
    exports.push(`export { getLocaleHead } from '@idiomi/react';`);
  }

  // Join imports with blank lines between each, then exports
  return [...imports.join('\n\n').split('\n'), ...exports].join('\n');
}

/**
 * Format TypeScript code using Prettier.
 * Uses the user's Prettier config if found, otherwise falls back to {singleQuote: true}.
 */
async function formatWithPrettier(
  code: string,
  filePath: string,
): Promise<string> {
  const prettier = await import('prettier');
  const config = await prettier.resolveConfig(filePath);
  return prettier.format(code, {
    // Spread user config if found, otherwise use our fallback
    ...(config ?? { singleQuote: true }),
    parser: 'typescript',
    filepath: filePath,
  });
}

interface GenerateIndexOptions {
  outputDir: string;
  locales: string[];
  defaultLocale: string;
  routing?: RoutingCompileOptions;
}

async function generateIndexTs(options: GenerateIndexOptions): Promise<void> {
  const { outputDir, locales, defaultLocale, routing } = options;
  // In non-suspense mode, Babel inlines translations at build time.
  // We call createTrans/createUseT without passing translations to avoid
  // importing translations.js at runtime, which enables tree shaking.
  const routeAwareCode =
    routing?.enabled && routing.framework
      ? generateRouteAwareCode({ routing, locales, defaultLocale })
      : '';

  const content = `// Auto-generated by @idiomi/core
// Do not edit directly
// Translations are inlined by Babel at build time

import {
  createIdiomiProvider,
  createTrans,
  createUseLocale,
  createUseT,
} from '@idiomi/react';

import type { IdiomiTypes, Locale } from './.generated/types';

export { locales, defaultLocale } from './.generated/config';
${routeAwareCode ? '\n' + routeAwareCode + '\n' : ''}
export const Trans = createTrans<IdiomiTypes>();

export const useT = createUseT<IdiomiTypes>();

export const IdiomiProvider = createIdiomiProvider();

export const useLocale = createUseLocale<Locale>();

export type { IdiomiTypes, Locale };
`;

  const filePath = join(outputDir, 'index.ts');
  const formatted = await formatWithPrettier(content, filePath);
  await fs.writeFile(filePath, formatted, 'utf-8');
}

async function generateIndexTsSuspense(
  options: GenerateIndexOptions,
): Promise<void> {
  const { outputDir, locales, defaultLocale, routing } = options;
  const routeAwareCode =
    routing?.enabled && routing.framework
      ? generateRouteAwareCode({ routing, locales, defaultLocale })
      : '';

  const content = `// Auto-generated by @idiomi/core
// Do not edit directly

import {
  createIdiomiProvider,
  createTransSuspense,
  createUseLocale,
  createUseTSuspense,
} from '@idiomi/react/runtime-suspense';

import type { IdiomiTypes, Locale } from './.generated/types';

export { locales, defaultLocale } from './.generated/config';
${routeAwareCode ? '\n' + routeAwareCode + '\n' : ''}
const config = {
  locales: ${JSON.stringify(locales)} as const,
};

export const Trans = createTransSuspense<IdiomiTypes>(config);

export const useT = createUseTSuspense<IdiomiTypes>(config);

export const IdiomiProvider = createIdiomiProvider();

export const useLocale = createUseLocale<Locale>();

export type { IdiomiTypes, Locale };
`;

  const filePath = join(outputDir, 'index.ts');
  const formatted = await formatWithPrettier(content, filePath);
  await fs.writeFile(filePath, formatted, 'utf-8');
}

async function generatePlainTs(outputDir: string): Promise<void> {
  const content = `// Auto-generated by @idiomi/core

import { _createTFactory } from '@idiomi/core/runtime';

import type { Locale, TranslationKey, MessageValues } from './.generated/types';

export const createT = (locale: Locale) =>
  _createTFactory<TranslationKey, MessageValues>(locale);

export type { Locale, TranslationKey, MessageValues };
`;

  const filePath = join(outputDir, 'plain.ts');
  const formatted = await formatWithPrettier(content, filePath);
  await fs.writeFile(filePath, formatted, 'utf-8');
}
