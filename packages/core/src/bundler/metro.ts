import type { Stats } from 'fs';
import { readFile, utimes } from 'fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import { isAbsolute, join, relative, resolve } from 'pathe';
import { compileTranslations } from '../compiler/compile.js';
import type { PoFormatOptions } from '../po/types.js';
import { ensureGitignore } from '../utils/gitignore.js';
import {
  loadPathsMatcher,
  type PathsMatcher,
} from '../utils/resolve-tsconfig-paths.js';
import {
  createDebouncedExtractor,
  type DebouncedExtractor,
} from './debounce.js';
import { createChokidarIgnoreFilter } from './ignore-patterns.js';
import { fileImportsIdioma } from './import-detect.js';
import { extractAndMergeFile } from './incremental-extract.js';
import {
  OPTIONS_ENV,
  transformerPath,
  UPSTREAM_ENV,
  type MetroTransformerOptions,
} from './metro-transformer.js';

export interface IdiomaMetroOptions {
  /**
   * Base directory for Idioma files.
   * Generated files go in {idiomaDir}/, PO files in {idiomaDir}/locales/ by default.
   */
  idiomaDir: string;
  /**
   * Directory containing PO files.
   * Override this if you have existing PO files elsewhere.
   * @default '{idiomaDir}/locales'
   */
  localesDir?: string;
  /** Default/source locale */
  defaultLocale: string;
  /** List of supported locales (auto-detected from PO files if not specified) */
  locales?: string[];
  /** Watch for changes in development (default: true) */
  watch?: boolean;
  /**
   * Enable Suspense-based lazy loading.
   * Requires React 19+.
   * @default false
   */
  useSuspense?: boolean;
  /**
   * Additional patterns to ignore when watching source files.
   * By default, patterns from .gitignore are used automatically.
   * Use this to add extra patterns beyond what's in .gitignore.
   */
  ignorePatterns?: string[];
  /**
   * How PO files are written during dev-mode extraction.
   * `foldLength` sets the column at which long lines are folded (0 disables
   * folding, default 76).
   */
  po?: PoFormatOptions;
}

interface MetroConfig {
  projectRoot?: string;
  watchFolders?: string[];
  [key: string]: unknown;
}

/**
 * Metro configuration helper for Idioma i18n.
 *
 * Features:
 * - Compiles PO files on Metro startup
 * - Watches PO files for changes in dev mode
 * - Triggers Metro refresh when translations change
 *
 * @example
 * // metro.config.js
 * const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
 * const { withIdioma } = require('@idioma/core/metro');
 *
 * const config = getDefaultConfig(__dirname);
 *
 * module.exports = withIdioma({
 *   idiomaDir: './src/idioma',
 *   defaultLocale: 'en',
 * })(config);
 */
export function withIdioma(
  options: IdiomaMetroOptions,
): (config: MetroConfig) => Promise<MetroConfig> {
  const {
    idiomaDir,
    localesDir,
    defaultLocale,
    locales,
    watch: enableWatch = true,
    useSuspense,
    ignorePatterns,
    po,
  } = options;

  // Compute derived paths
  const localeDir = localesDir ?? join(idiomaDir, 'locales');
  const outputDir = idiomaDir;
  const hasCustomLocalesDir = !!localesDir;

  let poWatcher: FSWatcher | null = null;
  let sourceWatcher: FSWatcher | null = null;
  let debouncedExtractor: DebouncedExtractor | null = null;
  let projectRoot = '';
  let pathsMatcher: PathsMatcher | null = null;

  async function compile(): Promise<void> {
    try {
      const resolvedIdiomaDir = resolve(projectRoot, idiomaDir);

      // Ensure .gitignore exists (skip creating locales/ if custom path provided)
      await ensureGitignore(resolvedIdiomaDir, {
        skipLocalesDir: hasCustomLocalesDir,
      });

      await compileTranslations({
        localeDir: resolve(projectRoot, localeDir),
        outputDir: resolve(projectRoot, outputDir),
        defaultLocale,
        locales,
        useSuspense,
        projectRoot,
      });
      console.log('[idioma] Translations compiled');
    } catch (error) {
      console.error('[idioma] Compilation error:', error);
    }
  }

  async function touchOutputFile(): Promise<void> {
    const indexPath = resolve(projectRoot, outputDir, 'index.ts');
    try {
      const now = new Date();
      await utimes(indexPath, now, now);
    } catch {
      // File might not exist yet, that's ok
    }
  }

  async function handleFileChange(path: string): Promise<void> {
    console.log(`[idioma] PO file changed: ${path}`);
    await compile();
    await touchOutputFile();
  }

  async function handleFileAdd(path: string): Promise<void> {
    console.log(`[idioma] PO file added: ${path}`);
    await compile();
    await touchOutputFile();
  }

  /**
   * Queues a changed source file for extraction, as the Vite plugin does.
   * Files inside idiomaDir are skipped: compile writes them and
   * touchOutputFile touches index.ts, so extracting them compiled again and
   * looped forever. Files that do not import from idiomaDir hold nothing to
   * extract.
   */
  async function queueSourceFile(path: string): Promise<void> {
    const absIdiomaDir = resolve(projectRoot, idiomaDir);
    const fromIdiomaDir = relative(absIdiomaDir, path);
    if (!fromIdiomaDir.startsWith('..') && !isAbsolute(fromIdiomaDir)) return;
    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch {
      // Deleted before it was read: nothing to extract
      return;
    }
    if (!fileImportsIdioma(content, path, absIdiomaDir, pathsMatcher)) return;
    debouncedExtractor?.add(path);
  }

  function setupWatcher(): void {
    // Set up PO file watcher
    if (!poWatcher) {
      // chokidar takes a folder, not a glob, since version 4
      poWatcher = watch(resolve(projectRoot, localeDir), {
        ignoreInitial: true,
        ignored: ignoreNonPoFiles,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      poWatcher.on('change', handleFileChange);
      poWatcher.on('add', handleFileAdd);
    }

    // Set up source file watcher for incremental extraction
    if (!sourceWatcher) {
      // Initialize debounced extractor
      debouncedExtractor = createDebouncedExtractor(
        async (files) => {
          for (const file of files) {
            await extractAndMergeFile({
              filePath: file,
              projectRoot,
              idiomaDir: resolve(projectRoot, idiomaDir),
              localeDir: resolve(projectRoot, localeDir),
              defaultLocale,
              locales: locales ?? [defaultLocale],
              po,
            });
          }
          // Recompile after extraction
          await compile();
          await touchOutputFile();
        },
        {
          delay: 200,
          onComplete: ({ files }) => {
            console.log(`[idioma] Extracted from ${files.length} file(s)`);
          },
          onError: (error) => {
            console.error('[idioma] Extraction error:', error);
          },
        },
      );

      // Watch source files, using .gitignore patterns automatically
      sourceWatcher = watch(projectRoot, {
        ignoreInitial: true,
        ignored: createSourceWatchIgnore(projectRoot, ignorePatterns),
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      sourceWatcher.on('change', queueSourceFile);
      sourceWatcher.on('add', queueSourceFile);
    }
  }

  return async function createConfig(
    metroConfig: MetroConfig,
  ): Promise<MetroConfig> {
    // Determine project root
    projectRoot = metroConfig.projectRoot || process.cwd();
    pathsMatcher = loadPathsMatcher(projectRoot);

    // Compile translations at startup
    await compile();

    // Set up watching if enabled
    if (enableWatch) {
      setupWatcher();
    }

    // Ensure output directory is in watchFolders for Metro
    const resolvedOutputDir = resolve(projectRoot, outputDir);
    const existingWatchFolders = metroConfig.watchFolders || [];
    const config: MetroConfig = {
      ...metroConfig,
      watchFolders: [...existingWatchFolders, resolvedOutputDir],
    };

    // Idioma's transformer runs before the app's own Babel transformer
    // (#20). Metro gives a transformer only the module, so what it needs goes
    // through the environment, which Metro's workers inherit.
    const transformer = metroConfig.transformer as
      | { babelTransformerPath?: string; [key: string]: unknown }
      | undefined;
    const upstreamPath = transformer?.babelTransformerPath;
    if (!upstreamPath) {
      console.warn(
        '[idioma] The Metro config has no transformer.babelTransformerPath to ' +
          'wrap, so Trans and t() are not transformed. Wrap the config from ' +
          "Expo's or React Native's getDefaultConfig().",
      );
      return config;
    }
    const transformerOptions: MetroTransformerOptions = {
      idiomaDir,
      projectRoot,
      useSuspense,
      locales,
    };
    process.env[UPSTREAM_ENV] = upstreamPath;
    process.env[OPTIONS_ENV] = JSON.stringify(transformerOptions);
    return {
      ...config,
      transformer: { ...transformer, babelTransformerPath: transformerPath },
    };
  };
}

const SOURCE_FILE = /\.(tsx|jsx|ts|js)$/;

/**
 * chokidar's `ignored` for the PO watcher: every file but a .po file.
 * Folders are never ignored, so namespace folders (locales/es/*.po) are
 * walked. chokidar calls it once without stats and once with them.
 *
 * @internal Exported for tests
 */
export function ignoreNonPoFiles(path: string, stats?: Stats): boolean {
  return stats?.isFile() === true && !path.endsWith('.po');
}

/**
 * chokidar's `ignored` for the source watcher: what .gitignore and the
 * base patterns ignore (node_modules, .git, .generated), and every file
 * that is not a script.
 *
 * @internal Exported for tests
 */
export function createSourceWatchIgnore(
  projectRoot: string,
  additionalPatterns?: string[],
): (path: string, stats?: Stats) => boolean {
  const ignoreFilter = createChokidarIgnoreFilter(
    projectRoot,
    additionalPatterns,
  );
  return (path, stats) =>
    ignoreFilter(path) || (stats?.isFile() === true && !SOURCE_FILE.test(path));
}
