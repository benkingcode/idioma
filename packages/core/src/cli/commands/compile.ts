import { defineCommand } from 'citty';
import { compileTranslations } from '../../compiler/compile.js';
import { ensureGitignore } from '../../utils/gitignore.js';
import { getIdiomaPaths, loadConfig } from '../config.js';
import { createSpinner } from '../ui/index.js';

export interface CompileResult {
  messageCount: number;
  locales: string[];
}

export interface CompileCommandOptions {
  localeDir: string;
  outputDir: string;
  defaultLocale: string;
  useSuspense?: boolean;
  locales?: string[];
  projectRoot?: string;
}

/**
 * Run the compile command programmatically.
 */
export async function runCompile(
  options: CompileCommandOptions,
): Promise<CompileResult> {
  const {
    localeDir,
    outputDir,
    defaultLocale,
    useSuspense,
    locales,
    projectRoot,
  } = options;

  await compileTranslations({
    localeDir,
    outputDir,
    defaultLocale,
    useSuspense,
    locales,
    projectRoot,
  });

  // Read back results to get stats
  const { promises: fs } = await import('fs');
  const { join } = await import('path');

  const files = await fs.readdir(localeDir);
  const poFiles = files.filter((f) => f.endsWith('.po'));
  const detectedLocales = poFiles.map((f) => f.replace('.po', ''));

  // Count messages from the translations file (in .generated/)
  const translationsPath = join(outputDir, '.generated', 'translations.js');
  const content = await fs.readFile(translationsPath, 'utf-8');
  const messageCount = (content.match(/^\s*"/gm) || []).length / 2;

  return {
    messageCount: Math.floor(messageCount),
    locales: detectedLocales,
  };
}

export const compileCommand = defineCommand({
  meta: {
    name: 'compile',
    description: 'Compile PO files to JavaScript/TypeScript',
  },
  args: {},
  async run() {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const { localeDir, outputDir } = getIdiomaPaths(config);

    // Ensure .gitignore exists in the idioma directory
    await ensureGitignore(config.idiomaDir);

    const spinner = createSpinner();
    spinner.start('Compiling translations...');

    try {
      const result = await runCompile({
        localeDir,
        outputDir,
        defaultLocale: config.defaultLocale,
        useSuspense: config.useSuspense,
        locales: config.locales,
        projectRoot: cwd,
      });

      spinner.succeed(
        `Compiled ${result.messageCount} messages for ${result.locales.length} locales (${result.locales.join(', ')})`,
      );
    } catch (error) {
      spinner.fail('Compilation failed');
      throw error;
    }
  },
});
