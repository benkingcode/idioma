import { existsSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';
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
    description: "Don't flag translations as ai-translated",
    default: true,
  },
  // citty reads --no-x as x = false, so the flag is --no-auto-context on
  // an argument named auto-context. An argument named no-auto-context
  // never became true. --help shows a default-true boolean as --no-x
  'auto-context': {
    type: 'boolean',
    description: 'Skip automatic AI context generation for messages',
    default: true,
  },
  verbose: {
    type: 'boolean',
    description: 'Show detailed logs including AI prompts',
    default: false,
  },
} as const;

export type TranslateCommandArgs = ParsedArgs<typeof translateArgs>;

/** Whether to generate translator context: off with --no-auto-context. */
export function autoContextEnabled(args: TranslateCommandArgs): boolean {
  return args['auto-context'] !== false;
}

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
 * It is found from the project, not from core: pnpm links only a
 * package's own dependencies next to it, so a bare import('@idioma/ai')
 * here would not find the project's copy. Core doesn't list @idioma/ai in
 * its package.json either, which would make the two packages a cycle.
 *
 * Only the project's node_modules folders count, as Node walks them up
 * from the project. require.resolve would also search NODE_PATH, which
 * pnpm's bin shims point at the workspace's hoisted packages, so it found
 * an @idioma/ai the project never installed.
 */
export async function loadAiPackage(
  projectRoot: string,
): Promise<AiPackage | undefined> {
  const manifest = findInNodeModules(projectRoot, '@idioma/ai');
  if (!manifest) return undefined;
  // From inside the package, its own name resolves through its exports
  const entry = createRequire(manifest).resolve('@idioma/ai');
  try {
    return (await import(pathToFileURL(entry).href)) as AiPackage;
  } catch (error) {
    if (isModuleNotFound(error, 'ai')) return undefined;
    throw error;
  }
}

/** A package's package.json in the node_modules folders above `from`. */
function findInNodeModules(from: string, name: string): string | undefined {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const manifest = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) return manifest;
    if (dirname(dir) === dir) return undefined;
  }
}

/** Whether an import failed because a package isn't installed. */
function isModuleNotFound(error: unknown, name?: string): boolean {
  const { code, message } = error as { code?: string; message?: string };
  if (code !== 'ERR_MODULE_NOT_FOUND' && code !== 'MODULE_NOT_FOUND') {
    return false;
  }
  return (
    name === undefined || new RegExp(`['"]${name}['"]`).test(message ?? '')
  );
}
