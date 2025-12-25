import { join } from 'path';
import { defineCommand } from 'citty';
import {
  createAnthropicContextProvider,
  createOpenAIContextProvider,
  generateContextForCatalog,
  type ContextProvider,
} from '../../ai/context.js';
import {
  formatBox,
  formatHeader,
  formatKeyValueList,
} from '../../ai/format.js';
import {
  createAnthropicProvider,
  createOpenAIProvider,
  type MessageToTranslate,
  type TranslationProvider,
} from '../../ai/provider.js';
import { loadPoFile, writePoFile } from '../../po/parser.js';
import { getIdiomaPaths, loadConfig } from '../config.js';

export interface TranslateResult {
  translated: number;
  skipped: number;
  total: number;
  dryRun?: boolean;
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
  /** Callback for verbose logging */
  onVerbose?: (message: string) => void;
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
    onVerbose,
  } = options;

  // Load default locale to get source text (msgstr contains the actual text)
  const defaultPoPath = join(localeDir, `${defaultLocale}.po`);
  const defaultCatalog = await loadPoFile(defaultPoPath, defaultLocale);

  // Build lookup: key -> source text from default locale's msgstr
  const sourceTextByKey = new Map<string, string>();
  for (const [key, message] of defaultCatalog.messages) {
    // In Idioma's hash-based system, msgid is the hash and msgstr is the source text
    sourceTextByKey.set(key, message.translation || message.source);
  }

  // Load target catalog
  const poPath = join(localeDir, `${targetLocale}.po`);
  const catalog = await loadPoFile(poPath, targetLocale);

  // Generate AI context for messages that need it
  if (autoContext && contextProvider && projectRoot) {
    await generateContextForCatalog({
      projectRoot,
      catalog,
      provider: contextProvider,
      sourceTextByKey,
    });
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
      messagesToTranslate.push({
        key,
        source: sourceText,
        context: message.comments?.join(' '),
      });
    } else {
      skippedKeys.add(key);
    }
  }

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
        message.translation = translation;

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

export const translateCommand = defineCommand({
  meta: {
    name: 'translate',
    description: 'Translate messages using AI',
  },
  args: {
    locale: {
      type: 'string',
      description: 'Target locale to translate',
      required: true,
    },
    provider: {
      type: 'string',
      description: 'AI provider (anthropic or openai)',
      default: 'anthropic',
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

    // Create verbose callback
    const onVerbose = args.verbose
      ? (msg: string) => console.log(msg)
      : undefined;

    // Create provider
    let provider: TranslationProvider;
    const providerName = args.provider as string;

    if (providerName === 'anthropic') {
      const apiKey = config.ai?.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error('Error: ANTHROPIC_API_KEY not set');
        process.exitCode = 1;
        return;
      }
      provider = createAnthropicProvider({
        apiKey,
        model: config.ai?.model,
        guidelines: config.ai?.guidelines,
        onVerbose,
      });
    } else if (providerName === 'openai') {
      const apiKey = config.ai?.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error('Error: OPENAI_API_KEY not set');
        process.exitCode = 1;
        return;
      }
      provider = createOpenAIProvider({
        apiKey,
        model: config.ai?.model,
        guidelines: config.ai?.guidelines,
        onVerbose,
      });
    } else {
      console.error(`Error: Unknown provider: ${providerName}`);
      process.exitCode = 1;
      return;
    }

    // Create context provider if auto-context is enabled
    const autoContext = !args['no-auto-context'];
    let contextProvider: ContextProvider | undefined;

    if (autoContext) {
      if (providerName === 'anthropic') {
        const apiKey = config.ai?.apiKey || process.env.ANTHROPIC_API_KEY;
        if (apiKey) {
          contextProvider = createAnthropicContextProvider({
            apiKey,
            model: config.ai?.model,
            guidelines: config.ai?.guidelines,
            onVerbose,
          });
        }
      } else if (providerName === 'openai') {
        const apiKey = config.ai?.apiKey || process.env.OPENAI_API_KEY;
        if (apiKey) {
          contextProvider = createOpenAIContextProvider({
            apiKey,
            model: config.ai?.model,
            guidelines: config.ai?.guidelines,
            onVerbose,
          });
        }
      }
    }

    const { localeDir } = getIdiomaPaths(config);

    console.log(`Translating to ${args.locale} using ${provider.name}...`);
    if (autoContext && contextProvider) {
      console.log('Auto-context generation enabled');
    }

    const result = await runTranslate({
      localeDir,
      defaultLocale: config.defaultLocale,
      targetLocale: args.locale as string,
      provider,
      force: args.force,
      dryRun: args['dry-run'],
      markAI: args['mark-ai'],
      autoContext: autoContext && !!contextProvider,
      contextProvider,
      projectRoot: cwd,
      onVerbose,
    });

    if (result.dryRun) {
      console.log('(dry run - no changes saved)');
    }

    console.log(`Translated: ${result.translated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Total: ${result.total}`);
  },
});
