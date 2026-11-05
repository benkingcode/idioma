import { defineCommand, type ParsedArgs } from 'citty';

/**
 * `idioma translate`, defined without its implementation. The CLI imports
 * every command to print its help, and the implementation imports the AI
 * SDK, an optional peer: so `run` loads it with import(), and every other
 * command, `idioma --help` included, works without the AI SDK installed.
 */
const translateArgs = {
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
} as const;

export type TranslateCommandArgs = ParsedArgs<typeof translateArgs>;

export const translateCommand = defineCommand({
  meta: {
    name: 'translate',
    description: 'Translate messages using AI',
  },
  args: translateArgs,
  async run({ args }) {
    let implementation: typeof import('./translate.js');
    try {
      implementation = await import('./translate.js');
    } catch (error) {
      if (isMissingAiSdk(error)) {
        console.error(
          '[idioma] idioma translate needs the AI SDK and a provider. ' +
            'Install them, for example: pnpm add -D ai@6 @ai-sdk/anthropic@3',
        );
        process.exitCode = 1;
        return;
      }
      throw error;
    }
    await implementation.runTranslateCommand(args);
  },
});

/** Whether an import failed because the `ai` package is not installed. */
function isMissingAiSdk(error: unknown): boolean {
  const { code, message } = error as { code?: string; message?: string };
  return (
    (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') &&
    /['"]ai['"]/.test(message ?? '')
  );
}
