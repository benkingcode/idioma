import { join, resolve } from 'path';
import { defineCommand } from 'citty';
import {
  createContextProvider,
  createDryRunContextProvider,
  generateContextForCatalog,
  type ContextFileProgress,
  type ContextProvider,
} from '../../ai/context.js';
import {
  formatBox,
  formatHeader,
  formatKeyValueList,
} from '../../ai/format.js';
import {
  createDryRunProvider,
  createTranslationProvider,
  type MessageToTranslate,
  type TranslationProvider,
} from '../../ai/provider.js';
import { loadPoFile, writePoFile } from '../../po/parser.js';
import { ROUTE_CONTEXT_PREFIX } from '../../routes/compile.js';
import { getIdiomiPaths, loadConfig } from '../config.js';
import { createAnimatedHeader, setNonInteractive } from '../ui/index.js';
import { colors } from '../ui/theme.js';
import { ensureExtracted } from './ensure-extracted.js';

/**
 * Slugify a route segment for URL-safe usage.
 * Removes accents, converts to lowercase, replaces spaces with hyphens.
 */
function slugifyRouteSegment(text: string): string {
  return (
    text
      // Normalize Unicode to decomposed form (separate base + combining marks)
      .normalize('NFD')
      // Remove combining diacritical marks (accents)
      .replace(/[\u0300-\u036f]/g, '')
      // Convert to lowercase
      .toLowerCase()
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Remove any remaining non-URL-safe characters (keep alphanumeric, hyphens)
      .replace(/[^a-z0-9-]/g, '')
      // Collapse multiple hyphens
      .replace(/-+/g, '-')
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
  );
}

export interface TranslateResult {
  translated: number;
  skipped: number;
  total: number;
  dryRun?: boolean;
}

/**
 * Progress information for translation callbacks.
 */
export interface TranslateProgress {
  /** Total messages to translate for this locale */
  totalMessages: number;
  /** Messages translated so far */
  completedMessages: number;
  /** Current batch number (1-indexed) */
  currentBatch: number;
  /** Total number of batches */
  totalBatches: number;
}

export interface TranslateAllResult {
  results: Map<string, TranslateResult>;
  errors: Map<string, Error>;
}

export interface TranslateOptions {
  localeDir: string;
  defaultLocale: string;
  targetLocale: string;
  provider: TranslationProvider;
  force?: boolean;
  dryRun?: boolean;
  markAI?: boolean;
  batchSize?: number;
  /** Enable automatic AI context generation (default: false) */
  autoContext?: boolean;
  /** Context provider to use for auto-context (required if autoContext is true) */
  contextProvider?: ContextProvider;
  /** Project root for resolving source file paths (required if autoContext is true) */
  projectRoot?: string;
  /** Absolute path to idiomi directory (required if autoContext is true) */
  idiomiDir?: string;
  /** Callback for verbose logging */
  onVerbose?: (message: string) => void;
  /** Called when we know how many messages need translation */
  onMessageCountKnown?: (count: number) => void;
  /** Called when a batch completes with progress info */
  onBatchComplete?: (progress: TranslateProgress) => void;
  /** Called when we know how many files need context generation */
  onContextFileCountKnown?: (count: number) => void;
  /** Called when starting to generate context for a file */
  onContextFileStart?: (
    filePath: string,
    currentFile: number,
    totalFiles: number,
  ) => void;
  /** Called when context generation completes for a file */
  onContextFileComplete?: (progress: ContextFileProgress) => void;
}

/**
 * Translate messages using AI.
 */
export async function runTranslate(
  options: TranslateOptions,
): Promise<TranslateResult> {
  const {
    localeDir,
    defaultLocale,
    targetLocale,
    provider,
    force = false,
    dryRun = false,
    markAI = false,
    batchSize = 20,
    autoContext = false,
    contextProvider,
    projectRoot,
    idiomiDir,
    onVerbose,
    onMessageCountKnown,
    onBatchComplete,
    onContextFileCountKnown,
    onContextFileStart,
    onContextFileComplete,
  } = options;

  // Load default locale to get source text (msgstr contains the actual text)
  const defaultPoPath = join(localeDir, `${defaultLocale}.po`);
  const defaultCatalog = await loadPoFile(defaultPoPath, defaultLocale);

  // Build lookup: key -> source text from default locale's msgstr
  const sourceTextByKey = new Map<string, string>();
  for (const [key, message] of defaultCatalog.messages) {
    // In Idiomi's hash-based system, msgid is the hash and msgstr is the source text
    sourceTextByKey.set(key, message.translation || message.source);
  }

  // Load target catalog
  const poPath = join(localeDir, `${targetLocale}.po`);
  const catalog = await loadPoFile(poPath, targetLocale);

  // Generate AI context for messages that need it
  // Context is stored in the default (source) locale so it's available for all target locales
  if (autoContext && contextProvider && projectRoot && idiomiDir) {
    const contextResult = await generateContextForCatalog({
      projectRoot,
      idiomiDir,
      catalog: defaultCatalog,
      provider: contextProvider,
      sourceTextByKey,
      onFileCountKnown: onContextFileCountKnown,
      onFileStart: onContextFileStart,
      onFileComplete: onContextFileComplete,
    });

    // Save default catalog if context was generated (skip in dry run mode)
    if (contextResult.generated > 0 && !dryRun) {
      await writePoFile(defaultPoPath, defaultCatalog);
    }
  }

  // Find messages that need translation
  const messagesToTranslate: MessageToTranslate[] = [];
  const skippedKeys = new Set<string>();

  for (const [key, message] of catalog.messages) {
    const needsTranslation =
      force || !message.translation || message.translation.length === 0;

    if (needsTranslation) {
      // Use source text from default locale, fall back to msgid if not found
      const sourceText = sourceTextByKey.get(key) || message.source;
      // Read context from default (source) locale, not target locale
      const defaultMessage = defaultCatalog.messages.get(key);

      // Build context string
      let context = defaultMessage?.comments?.join(' ');

      // Add special context for route segments
      if (message.context?.startsWith('route:')) {
        const routeContext =
          'URL path segment - must be URL-safe (no spaces, use hyphens if needed)';
        context = context ? `${routeContext}. ${context}` : routeContext;
      }

      messagesToTranslate.push({
        key,
        source: sourceText,
        context,
      });
    } else {
      skippedKeys.add(key);
    }
  }

  // Notify about message count
  onMessageCountKnown?.(messagesToTranslate.length);

  if (messagesToTranslate.length === 0) {
    return {
      translated: 0,
      skipped: skippedKeys.size,
      total: catalog.messages.size,
      dryRun,
    };
  }

  // Translate in batches
  const translatedMessages: Map<string, string> = new Map();
  const totalBatches = Math.ceil(messagesToTranslate.length / batchSize);

  for (let i = 0; i < messagesToTranslate.length; i += batchSize) {
    const batch = messagesToTranslate.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    if (onVerbose) {
      onVerbose(
        `\n${formatHeader(`Translation Batch ${batchNum}/${totalBatches} (${batch.length} messages)`)}`,
      );
    }

    const results = await provider.translate({
      messages: batch,
      sourceLocale: defaultLocale,
      targetLocale,
    });

    for (const result of results) {
      translatedMessages.set(result.key, result.translation);
    }

    // Notify about batch completion with progress
    onBatchComplete?.({
      totalMessages: messagesToTranslate.length,
      completedMessages: translatedMessages.size,
      currentBatch: batchNum,
      totalBatches,
    });

    if (onVerbose) {
      onVerbose(
        formatBox(
          'Response',
          formatKeyValueList(
            results.map((r) => ({ key: r.key, value: r.translation })),
          ),
        ),
      );
    }
  }

  // Update catalog with translations
  if (!dryRun) {
    for (const [key, translation] of translatedMessages) {
      const message = catalog.messages.get(key);
      if (message) {
        // Slugify route translations to ensure URL-safe values
        const finalTranslation = message.context?.startsWith(
          ROUTE_CONTEXT_PREFIX,
        )
          ? slugifyRouteSegment(translation)
          : translation;
        message.translation = finalTranslation;

        if (markAI) {
          message.flags = message.flags || [];
          if (!message.flags.includes('ai-translated')) {
            message.flags.push('ai-translated');
          }
        }
      }
    }

    await writePoFile(poPath, catalog);
  }

  return {
    translated: translatedMessages.size,
    skipped: skippedKeys.size,
    total: catalog.messages.size,
    dryRun,
  };
}

export interface TranslateAllOptions extends Omit<
  TranslateOptions,
  'targetLocale'
> {
  targetLocales: string[];
  /** Called when starting to translate a locale */
  onLocaleStart?: (locale: string) => void;
  /** Called when a locale translation completes (success or error) */
  onLocaleComplete?: (locale: string, result: TranslateResult) => void;
}

/**
 * Translate messages to multiple locales using AI.
 * Continues on error and collects all failures.
 */
export async function runTranslateAll(
  options: TranslateAllOptions,
): Promise<TranslateAllResult> {
  const {
    localeDir,
    defaultLocale,
    targetLocales,
    provider,
    force,
    dryRun,
    markAI,
    batchSize,
    autoContext,
    contextProvider,
    projectRoot,
    idiomiDir,
    onVerbose,
    onMessageCountKnown,
    onBatchComplete,
    onContextFileCountKnown,
    onContextFileStart,
    onContextFileComplete,
    onLocaleStart,
    onLocaleComplete,
  } = options;

  const results = new Map<string, TranslateResult>();
  const errors = new Map<string, Error>();

  // Generate AI context ONCE before translating any locales
  // Context is stored in the default (source) locale and shared across all target locales
  if (autoContext && contextProvider && projectRoot && idiomiDir) {
    const defaultPoPath = join(localeDir, `${defaultLocale}.po`);
    const defaultCatalog = await loadPoFile(defaultPoPath, defaultLocale);

    // Build lookup: key -> source text from default locale's msgstr
    const sourceTextByKey = new Map<string, string>();
    for (const [key, message] of defaultCatalog.messages) {
      sourceTextByKey.set(key, message.translation || message.source);
    }

    const contextResult = await generateContextForCatalog({
      projectRoot,
      idiomiDir,
      catalog: defaultCatalog,
      provider: contextProvider,
      sourceTextByKey,
      onFileCountKnown: onContextFileCountKnown,
      onFileStart: onContextFileStart,
      onFileComplete: onContextFileComplete,
    });

    // Save default catalog if context was generated (skip in dry run mode)
    if (contextResult.generated > 0 && !dryRun) {
      await writePoFile(defaultPoPath, defaultCatalog);
    }
  }

  // Now translate each locale
  for (const locale of targetLocales) {
    onLocaleStart?.(locale);

    try {
      const result = await runTranslate({
        localeDir,
        defaultLocale,
        targetLocale: locale,
        provider,
        force,
        dryRun,
        markAI,
        batchSize,
        // Context already generated above, don't do it again per-locale
        autoContext: false,
        onVerbose,
        onMessageCountKnown,
        onBatchComplete,
      });

      results.set(locale, result);
      onLocaleComplete?.(locale, result);
    } catch (error) {
      errors.set(
        locale,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  return { results, errors };
}

export const translateCommand = defineCommand({
  meta: {
    name: 'translate',
    description: 'Translate messages using AI',
  },
  args: {
    locale: {
      type: 'string',
      description:
        'Target locale to translate (translates all locales if not specified)',
    },
    force: {
      type: 'boolean',
      description: 'Retranslate existing translations',
      default: false,
    },
    'dry-run': {
      type: 'boolean',
      description: 'Preview translations without saving',
      default: false,
    },
    'mark-ai': {
      type: 'boolean',
      description: 'Mark translations with ai-translated flag',
      default: true,
    },
    'no-auto-context': {
      type: 'boolean',
      description: 'Skip automatic AI context generation for messages',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Show detailed logs including AI prompts',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    // Verbose mode uses non-interactive output (no spinners/progress bars)
    if (args.verbose) {
      setNonInteractive(true);
    }

    // Create verbose callback
    const onVerbose = args.verbose
      ? (msg: string) => console.log(msg)
      : undefined;

    // Get AI config
    const { model, guidelines, providerOptions } = config.ai ?? {};

    // Create provider
    let provider: TranslationProvider;

    // In dry run mode, use a provider that skips AI calls
    if (args['dry-run']) {
      provider = createDryRunProvider({
        guidelines,
        onVerbose,
      });
    } else {
      // Require explicit model configuration
      if (!model) {
        console.error('Error: AI model not configured.\n');
        console.error('Add to idiomi.config.ts:');
        console.error('');
        console.error('  import { anthropic } from "@ai-sdk/anthropic";');
        console.error('');
        console.error('  export default defineConfig({');
        console.error('    // ... other config');
        console.error('    ai: {');
        console.error('      model: anthropic("claude-sonnet-4-20250514"),');
        console.error('    },');
        console.error('  });');
        console.error('');
        console.error(
          'See https://ai-sdk.dev/providers for available providers.',
        );
        process.exitCode = 1;
        return;
      }

      provider = createTranslationProvider({
        model,
        guidelines,
        providerOptions,
        onVerbose,
      });
    }

    // Create context provider if auto-context is enabled
    const autoContext = !args['no-auto-context'];
    let contextProvider: ContextProvider | undefined;

    if (autoContext) {
      if (args['dry-run']) {
        contextProvider = createDryRunContextProvider({
          guidelines,
          onVerbose,
        });
      } else if (model) {
        contextProvider = createContextProvider({
          model,
          guidelines,
          providerOptions,
          onVerbose,
        });
      }
    }

    const { localeDir } = getIdiomiPaths(config);

    // Determine target locales
    const targetLocales = args.locale
      ? [args.locale as string]
      : (config.locales ?? []).filter((l) => l !== config.defaultLocale);

    if (targetLocales.length === 0) {
      console.error('Error: No target locales to translate');
      console.error(
        'Either specify a locale or configure locales in idiomi.config.ts',
      );
      process.exitCode = 1;
      return;
    }

    // Start animated header (globe + config info)
    // Extract model info (LanguageModel can be string or object with provider/modelId)
    const modelInfo =
      model && typeof model === 'object'
        ? { provider: model.provider, modelId: model.modelId }
        : typeof model === 'string'
          ? { provider: 'ai-sdk', modelId: model }
          : undefined;

    const header = createAnimatedHeader();
    header.start({
      title: 'idiomi translate',
      autoContext,
      provider: args['dry-run'] ? 'dry-run' : (modelInfo?.provider ?? 'ai-sdk'),
      model: modelInfo?.modelId,
    });

    // Ensure PO files exist (auto-extract if missing)
    // Skip in dry run mode - we don't want to write any files
    if (!args['dry-run']) {
      const allLocales = [config.defaultLocale, ...targetLocales].filter(
        (v, i, a) => a.indexOf(v) === i,
      );
      await ensureExtracted({
        localeDir,
        locales: allLocales,
        cwd,
        config,
        onExtractStart: () => {
          header.setStatus('PO files missing, extracting messages first...');
        },
        onExtractComplete: ({ messages, files }) => {
          header.log(`✔ Extracted ${messages} messages from ${files} files`);
        },
      });
    }

    let currentLocaleIndex = 0;
    let currentLocaleLabel = '';
    let currentTotal = 0;

    const { results, errors } = await runTranslateAll({
      localeDir,
      defaultLocale: config.defaultLocale,
      targetLocales,
      provider,
      force: args.force,
      dryRun: args['dry-run'],
      markAI: args['mark-ai'],
      autoContext: autoContext && !!contextProvider,
      contextProvider,
      projectRoot: cwd,
      idiomiDir: resolve(cwd, config.idiomiDir),
      onVerbose,
      onContextFileCountKnown: (count) => {
        if (count > 0) {
          header.setProgress('Generating context', 0, count);
        }
      },
      onContextFileComplete: (progress) => {
        header.setProgress(
          'Generating context',
          progress.currentFile,
          progress.totalFiles,
        );
        if (progress.currentFile === progress.totalFiles) {
          header.log(
            `✔ Generated context for ${progress.totalMessagesGenerated} messages`,
          );
        }
      },
      onLocaleStart: (locale) => {
        currentLocaleLabel =
          targetLocales.length > 1
            ? `[${currentLocaleIndex + 1}/${targetLocales.length}] ${locale}`
            : locale;
      },
      onMessageCountKnown: (count) => {
        currentTotal = count;
        if (count > 0) {
          header.setProgress(currentLocaleLabel, 0, count);
        }
      },
      onBatchComplete: (progress) => {
        header.setProgress(
          currentLocaleLabel,
          progress.completedMessages,
          currentTotal,
        );
      },
      onLocaleComplete: (_locale, result) => {
        const checkmark =
          result.translated > 0 ? colors().success('✔') : colors().primary('✔');
        header.log(
          `${checkmark} ${currentLocaleLabel}: ${result.translated} translated, ${result.skipped} skipped`,
        );
        currentLocaleIndex++;
      },
    });

    // Stop the animated header now that translation is complete
    header.stop();

    // Summary
    let totalTranslated = 0;
    let totalSkipped = 0;

    for (const [, result] of results) {
      totalTranslated += result.translated;
      totalSkipped += result.skipped;
    }

    if (targetLocales.length > 1) {
      console.log('');
      console.log(
        `Summary: ${totalTranslated} translated, ${totalSkipped} skipped across ${results.size} locales`,
      );
    }

    // Report errors
    if (errors.size > 0) {
      console.log('');
      console.error('Errors:');
      for (const [locale, error] of errors) {
        console.error(`  [${locale}] ${error.message}`);
      }
      process.exitCode = 1;
    }
  },
});
