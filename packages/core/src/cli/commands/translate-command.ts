import { createRequire } from 'module';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { defineCommand, type ParsedArgs } from 'citty';

/**
 * `idioma translate`. Core defines the command and its arguments; the
 * implementation is @idioma/ai, a separate package with the AI SDK as a
 * peer. Core never imports either, so a project that doesn't translate
 * installs neither.
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
    await runTranslateCli(args, process.cwd());
  },
});

/** What core's CLI calls in @idioma/ai. Its entry point `satisfies` this. */
export interface AiPackage {
  runTranslateCommand(args: TranslateCommandArgs): Promise<void>;
}

export const AI_INSTALL_HINT =
  '[idioma] idioma translate needs @idioma/ai, the AI SDK and a provider. ' +
  'Install them, for example: pnpm add -D @idioma/ai ai@6 @ai-sdk/anthropic@3';

/** Runs @idioma/ai's translate, or says what to install. */
export async function runTranslateCli(
  args: TranslateCommandArgs,
  projectRoot: string,
): Promise<void> {
  const ai = await loadAiPackage(projectRoot);
  if (!ai) {
    console.error(AI_INSTALL_HINT);
    process.exitCode = 1;
    return;
  }
  await ai.runTranslateCommand(args);
}

/**
 * @idioma/ai as the project installed it, or undefined when the project
 * has no @idioma/ai, or has it without the AI SDK.
 *
 * It is resolved from the project, not from core: pnpm links only a
 * package's own dependencies next to it, so a bare import('@idioma/ai')
 * here would not find the project's copy. Core doesn't list @idioma/ai in
 * its package.json either, which would make the two packages a cycle.
 */
export async function loadAiPackage(
  projectRoot: string,
): Promise<AiPackage | undefined> {
  let entry: string;
  try {
    entry = createRequire(join(projectRoot, 'package.json')).resolve(
      '@idioma/ai',
    );
  } catch (error) {
    if (isModuleNotFound(error)) return undefined;
    throw error;
  }
  try {
    return (await import(pathToFileURL(entry).href)) as AiPackage;
  } catch (error) {
    if (isModuleNotFound(error, 'ai')) return undefined;
    throw error;
  }
}

/** Whether a resolve or import failed because a package isn't installed. */
function isModuleNotFound(error: unknown, name?: string): boolean {
  const { code, message } = error as { code?: string; message?: string };
  if (code !== 'ERR_MODULE_NOT_FOUND' && code !== 'MODULE_NOT_FOUND') {
    return false;
  }
  return (
    name === undefined || new RegExp(`['"]${name}['"]`).test(message ?? '')
  );
}
