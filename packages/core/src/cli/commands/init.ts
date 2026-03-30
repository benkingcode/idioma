import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { defineCommand } from 'citty';
import { compileTranslations } from '../../compiler/compile.js';
import { writePoFile } from '../../po/parser.js';
import type { Catalog } from '../../po/types.js';
import { ensureGitignore } from '../../utils/gitignore.js';
import { getIdiomaPaths, loadConfig, type IdiomaConfig } from '../config.js';
import { createSpinner } from '../ui/index.js';

export interface InitOptions {
  cwd: string;
  config: IdiomaConfig;
}

export interface InitResult {
  /** Locales for which PO files were created */
  createdLocales: string[];
  /** Locales whose existing PO files were preserved */
  skippedLocales: string[];
}

/**
 * Run the init command programmatically.
 *
 * Creates the Idioma directory structure with empty PO files
 * and generates typed scaffolding (index.ts, plain.ts, .generated/).
 */
export async function runInit(options: InitOptions): Promise<InitResult> {
  const { cwd, config } = options;
  const { localeDir, outputDir } = getIdiomaPaths(config);

  const resolvedLocaleDir = resolve(cwd, localeDir);
  const resolvedOutputDir = resolve(cwd, outputDir);
  const resolvedIdiomaDir = resolve(cwd, config.idiomaDir);

  // 1. Create directory structure + .gitignore
  const hasCustomLocalesDir = !!config.localesDir;
  await ensureGitignore(resolvedIdiomaDir, {
    skipLocalesDir: hasCustomLocalesDir,
  });
  if (hasCustomLocalesDir) {
    await fs.mkdir(resolvedLocaleDir, { recursive: true });
  }

  // 2. Create empty PO files for each locale (skip existing)
  const locales = config.locales ?? [config.defaultLocale];
  const createdLocales: string[] = [];
  const skippedLocales: string[] = [];

  for (const locale of locales) {
    const poPath = join(resolvedLocaleDir, `${locale}.po`);
    const exists = await fileExists(poPath);

    if (exists) {
      skippedLocales.push(locale);
      continue;
    }

    const emptyCatalog: Catalog = {
      locale,
      headers: {
        Language: locale,
        'Content-Type': 'text/plain; charset=UTF-8',
      },
      messages: new Map(),
    };

    await writePoFile(poPath, emptyCatalog);
    createdLocales.push(locale);
  }

  // 3. Compile to generate index.ts, plain.ts, .generated/*
  await compileTranslations({
    localeDir: resolvedLocaleDir,
    outputDir: resolvedOutputDir,
    defaultLocale: config.defaultLocale,
    useSuspense: config.useSuspense,
    locales: config.locales,
    projectRoot: cwd,
  });

  return { createdLocales, skippedLocales };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize Idioma directory structure',
  },
  args: {},
  async run() {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    const spinner = createSpinner();
    spinner.start('Initializing Idioma...');

    try {
      const result = await runInit({ cwd, config });

      const parts: string[] = [];
      if (result.createdLocales.length > 0) {
        parts.push(`Created PO files for: ${result.createdLocales.join(', ')}`);
      }
      if (result.skippedLocales.length > 0) {
        parts.push(`Preserved existing: ${result.skippedLocales.join(', ')}`);
      }

      spinner.succeed(`Initialized Idioma. ${parts.join('. ')}`);

      console.log(
        '\nNext steps:\n' +
          '  1. Import { Trans, useT } from your idioma directory\n' +
          '  2. Run `idioma extract` after adding translations\n' +
          '  3. Run `idioma compile` to rebuild\n',
      );
    } catch (error) {
      spinner.fail('Initialization failed');
      throw error;
    }
  },
});
