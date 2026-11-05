import { promises as fs } from 'fs';
import { basename, join } from 'path';
import {
  TYPE,
  type DateElement,
  type LiteralElement,
  type MessageFormatElement,
  type NumberElement,
  type PluralElement,
  type PluralOrSelectOption,
  type SelectElement,
  type TimeElement,
} from '@formatjs/icu-messageformat-parser';
import {
  analyzeIcuMessage,
  parseIcu,
  type IcuAnalysis,
} from '../icu/compiler.js';
import { loadLocaleCatalogs } from '../po/parser.js';
import type { Catalog, Message } from '../po/types.js';
import { writeIfChanged } from '../utils/write-if-changed.js';
import { analyzeChunksFromCatalogs } from './chunk-analysis.js';
import { generateChunkModules } from './generate-chunks.js';

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
  /** The variables formatted as a date or time */
  dateVariables?: string[];
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

  // A key's types (variables, component count) come from its first non-empty
  // translation, reading the default locale first. They used to come from
  // whichever catalogue the directory listed first, even when its msgstr was
  // empty, so a new key typed as taking no values (issue #13).
  const typedKeys = new Set<string>();
  const localeOrder = [...allCatalogs.keys()].sort(
    (a, b) => Number(b === defaultLocale) - Number(a === defaultLocale),
  );

  for (const locale of localeOrder) {
    const nsCatalogs = allCatalogs.get(locale)!;
    for (const [namespace, catalog] of nsCatalogs) {
      for (const [key, message] of catalog.messages) {
        // Create a unique composite key for internal tracking
        const compositeKey = namespace ? `${namespace}:${key}` : key;
        // Use the translation (not source which is just a hash key) for analysis
        const translationText = message.translation || '';
        // Skip ICU analysis if message has component tags (they break the ICU parser)
        const hasComponentTags = /<\d+>/.test(translationText);

        // Analyse this locale's own text: translations of one key can differ
        // in ICU shape, e.g. a plain "{count} sets" source and a plural in
        // another locale (issue #13).
        let analysis: IcuAnalysis | undefined;
        if (translationText && !hasComponentTags) {
          try {
            analysis = analyzeIcuMessage(translationText);
          } catch (error) {
            // A plural or select that does not parse used to be kept as
            // plain text, so the page rendered the raw ICU. Other text the
            // parser rejects stays plain text, as before.
            if (looksLikePluralOrSelect(translationText)) {
              const file = namespace
                ? `${locale}/${namespace}.po`
                : `${locale}.po`;
              const reason =
                error instanceof Error ? error.message : String(error);
              throw new Error(
                `[idioma] ${file}: ${JSON.stringify(key)} is not valid ICU MessageFormat (${reason}): ${translationText}`,
                { cause: error },
              );
            }
          }
        }

        let compiled = allMessages.get(compositeKey);
        if (!compiled) {
          compiled = {
            key,
            translations: {},
            isIcu: false,
            variables: [],
            componentCount: 0,
            namespace,
          };
          allMessages.set(compositeKey, compiled);
        }

        if (translationText && !typedKeys.has(compositeKey)) {
          typedKeys.add(compositeKey);
          compiled.variables = analysis?.variables ?? [];
          compiled.dateVariables = analysis?.dateVariables ?? [];
          compiled.componentCount = countComponentTags(translationText);
        }

        if (!translationText) continue;

        if (hasComponentTags) {
          // Messages with component tags are handled differently - just store as string
          compiled.translations[locale] = translationText;
          continue;
        }

        const hasIcu =
          analysis?.hasPlural ||
          analysis?.hasSelect ||
          analysis?.hasFormat ||
          message.flags?.includes('icu-format');

        if (hasIcu) {
          try {
            compiled.translations[locale] = compileIcuToFunctionString(
              translationText,
              locale,
              analysis,
            );
          } catch (error) {
            const file = namespace
              ? `${locale}/${namespace}.po`
              : `${locale}.po`;
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `[idioma] ${file}: ${JSON.stringify(key)} cannot be compiled (${reason}): ${translationText}`,
              { cause: error },
            );
          }
          compiled.isIcu = true;
        } else {
          compiled.translations[locale] = translationText;
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
    await generateIndexTs(outputDir, defaultLocale);
  }

  // Generate plain.ts for imperative translation (user-facing, at outputDir root)
  await generatePlainTs(outputDir, defaultLocale);
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

  if (!analysis.hasPlural && !analysis.hasSelect && !analysis.hasFormat) {
    // No plural, select or format: the message is its own template, and its
    // placeholders are filled in at runtime. Never code made from a name.
    return `(args) => ${JSON.stringify(message)}`;
  }

  // Parse the ICU message and generate JavaScript code
  const ast = parseIcu(message);
  const body = generateCodeForElements(ast, locale);

  return `(args) => { ${body} }`;
}

/** Whether a message has a plural, select or selectordinal argument. */
function looksLikePluralOrSelect(message: string): boolean {
  return /\{\s*[^{},]+,\s*(?:plural|select|selectordinal|number|date|time)\s*[,}]/.test(
    message,
  );
}

/**
 * The Intl options for ICU's named styles, as FormatJS's intl-messageformat
 * defines them. A skeleton (::currency/EUR) gives its own options instead.
 */
const NUMBER_STYLES: Record<string, Intl.NumberFormatOptions> = {
  integer: { maximumFractionDigits: 0 },
  percent: { style: 'percent' },
};
const DATE_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  short: { month: 'numeric', day: 'numeric', year: '2-digit' },
  medium: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { month: 'long', day: 'numeric', year: 'numeric' },
  full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
};
const TIME_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  short: { hour: 'numeric', minute: 'numeric' },
  medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  long: {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short',
  },
  full: {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short',
  },
};

type FormatElement = NumberElement | DateElement | TimeElement;

/**
 * The Intl options for a number, date or time argument. A style or skeleton
 * Intl cannot format (a bare `currency` has no currency code) throws here,
 * so it fails the compile instead of the page.
 */
function formatOptions(
  el: FormatElement,
  locale: string,
): Intl.NumberFormatOptions | Intl.DateTimeFormatOptions {
  const kind =
    el.type === TYPE.number
      ? 'number'
      : el.type === TYPE.date
        ? 'date'
        : 'time';
  const style = el.style;
  let options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
  if (style == null) {
    options = {};
  } else if (typeof style === 'string') {
    const table =
      kind === 'number'
        ? NUMBER_STYLES
        : kind === 'date'
          ? DATE_STYLES
          : TIME_STYLES;
    const named = table[style];
    if (!named) {
      throw new Error(
        `unsupported ${kind} style "${style}": use one of ${Object.keys(table).join(', ')}, or a skeleton such as ${
          kind === 'number' ? '::currency/EUR' : '::yMMMd'
        }`,
      );
    }
    options = named;
  } else {
    options = style.parsedOptions as
      | Intl.NumberFormatOptions
      | Intl.DateTimeFormatOptions;
  }
  if (kind === 'number') {
    new Intl.NumberFormat(locale, options as Intl.NumberFormatOptions);
  } else {
    new Intl.DateTimeFormat(locale, options as Intl.DateTimeFormatOptions);
  }
  return options;
}

/**
 * Code that formats a number, date or time argument with Intl, with the
 * options worked out at build time. A missing value stays a placeholder,
 * as it does in a plain message.
 */
function formatCode(el: FormatElement, locale: string): string {
  const options = JSON.stringify(formatOptions(el, locale));
  const value = argument(el.value);
  const loc = JSON.stringify(locale);
  const formatted =
    el.type === TYPE.number
      ? `new Intl.NumberFormat(${loc}, ${options}).format(Number(${value}))`
      : `new Intl.DateTimeFormat(${loc}, ${options}).format(${value} instanceof Date ? ${value} : new Date(${value}))`;
  return `(${value} === undefined ? ${JSON.stringify(`{${el.value}}`)} : ${formatted})`;
}

/** Code that formats a plural's # as a number in the locale. */
function formatPoundCode(valueExpr: string, locale: string): string {
  return `new Intl.NumberFormat(${JSON.stringify(locale)}).format(${valueExpr})`;
}

/** Code that reads a value by name: args["user.name"], never args.<name>. */
function argument(name: string): string {
  return `args[${JSON.stringify(name)}]`;
}

/**
 * Generate JavaScript code for a list of message format elements.
 * Returns code that evaluates to a template: the branch a plural or select
 * picks, with # filled in and every {placeholder} and <Tag> left for the
 * runtime, which renders it as it renders a plain message.
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
        parts.push(JSON.stringify(`{${el.value}}`));
        break;

      case TYPE.plural:
        parts.push(generatePluralCode(el as PluralElement, locale));
        break;

      case TYPE.select:
        parts.push(generateSelectCode(el as SelectElement, locale));
        break;

      case TYPE.pound:
        // # in plural: the plural value, formatted as a number
        if (pluralValueExpr) {
          parts.push(formatPoundCode(pluralValueExpr, locale));
        }
        break;

      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        parts.push(formatCode(el, locale));
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
  code += `const pr = new Intl.PluralRules(${JSON.stringify(locale)}); `;
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
  code += `})(Number(${argument(varName)}))`;

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
        parts.push(JSON.stringify(`{${el.value}}`));
        break;
      case TYPE.pound:
        // # in plural: the plural value, formatted as a number
        if (valueExpr) {
          parts.push(formatPoundCode(valueExpr, locale));
        }
        break;
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        parts.push(formatCode(el, locale));
        break;
      case TYPE.plural:
        parts.push(generatePluralCode(el as PluralElement, locale));
        break;
      case TYPE.select:
        parts.push(generateSelectCode(el as SelectElement, locale));
        break;
      default:
        parts.push(JSON.stringify(`{${(el as { value: string }).value}}`));
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
    code += `if (sv === ${JSON.stringify(key)}) { ${optionCode} } `;
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
  code += `})(String(${argument(varName)} ?? ''))`;

  return code;
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

  // Write .js for the bundler: the Vite and Metro transforms load it at build time
  // No .d.ts needed since user code doesn't import translations.js directly
  await writeIfChanged(join(outputDir, 'translations.js'), content);
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
        .map((v) =>
          msg.dateVariables?.includes(v)
            ? `${quoteIfNeeded(v)}: Date | string | number`
            : `${quoteIfNeeded(v)}: string | number`,
        )
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

  // Generate IdiomaTypes - bundles all types for cleaner factory API
  content += '/** Combined types for createTrans/createUseT factories */\n';
  content += 'export interface IdiomaTypes {\n';
  content += '  TranslationKey: TranslationKey;\n';
  content += '  MessageValues: MessageValues;\n';
  content += '  MessageComponents: MessageComponents;\n';
  content += '}\n';

  await writeIfChanged(join(outputDir, 'types.d.ts'), content);
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

async function generateIndexTs(
  outputDir: string,
  defaultLocale: string,
): Promise<void> {
  // In non-suspense mode, Babel inlines translations at build time.
  // We call createTrans/createUseT without passing translations to avoid
  // importing translations.js at runtime, which enables tree shaking.
  const content = `// Auto-generated by @idioma/core
// Do not edit directly
// Translations are inlined by Babel at build time

import {
  createIdiomaProvider,
  createTrans,
  createUseLocale,
  createUseT,
} from '@idioma/react';
import type { IdiomaTypes, Locale } from './.generated/types';

export const Trans = createTrans<IdiomaTypes>();
export const useT = createUseT<IdiomaTypes>();
export const IdiomaProvider = createIdiomaProvider({
  defaultLocale: ${quote(defaultLocale)},
});
export const useLocale = createUseLocale();

export type { IdiomaTypes, Locale };
`;

  await writeIfChanged(join(outputDir, 'index.ts'), content);
}

async function generateIndexTsSuspense(
  outputDir: string,
  locales: string[],
): Promise<void> {
  const content = `// Auto-generated by @idioma/core
// Do not edit directly

import {
  createIdiomaProvider,
  createTransSuspense,
  createUseLocale,
  createUseTSuspense,
} from '@idioma/react/runtime-suspense';
import type { IdiomaTypes, Locale } from './.generated/types';

const config = {
  locales: ${JSON.stringify(locales)} as const,
};

export const Trans = createTransSuspense<IdiomaTypes>(config);
export const useT = createUseTSuspense<IdiomaTypes>(config);
export const IdiomaProvider = createIdiomaProvider();
export const useLocale = createUseLocale();

export type { IdiomaTypes, Locale };
`;

  await writeIfChanged(join(outputDir, 'index.ts'), content);
}

/** A single-quoted TypeScript string literal, as generated files are written. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function generatePlainTs(
  outputDir: string,
  defaultLocale: string,
): Promise<void> {
  const content = `// Auto-generated by @idioma/core
import { _createTFactory } from '@idioma/core/runtime';
import type { Locale, TranslationKey, MessageValues } from './.generated/types';

export const createT = (locale: Locale) =>
  _createTFactory<TranslationKey, MessageValues>(locale, undefined, {
    defaultLocale: ${quote(defaultLocale)},
  });

export type { Locale, TranslationKey, MessageValues };
`;

  await writeIfChanged(join(outputDir, 'plain.ts'), content);
}
