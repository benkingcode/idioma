import { utimes } from 'fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import { join, resolve } from 'pathe';
import { compileTranslations } from '../compiler/compile.js';
import { ensureGitignore } from '../utils/gitignore.js';
import {
  createDebouncedExtractor,
  type DebouncedExtractor,
} from './debounce.js';
import { createChokidarIgnoreFilter } from './ignore-patterns.js';
import { extractAndMergeFile } from './incremental-extract.js';

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
  } = options;

  // Compute derived paths
  const localeDir = localesDir ?? join(idiomaDir, 'locales');
  const outputDir = idiomaDir;
  const hasCustomLocalesDir = !!localesDir;

  let poWatcher: FSWatcher | null = null;
  let sourceWatcher: FSWatcher | null = null;
  let debouncedExtractor: DebouncedExtractor | null = null;
  let projectRoot = '';

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

  function setupWatcher(): void {
    // Set up PO file watcher
    if (!poWatcher) {
      const poWatchPath = resolve(projectRoot, localeDir, '**/*.po');

      poWatcher = watch(poWatchPath, {
        ignoreInitial: true,
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
      const sourceWatchPath = resolve(projectRoot, '**/*.{tsx,jsx,ts,js}');
      const ignoreFilter = createChokidarIgnoreFilter(
        projectRoot,
        ignorePatterns,
      );

      sourceWatcher = watch(sourceWatchPath, {
        ignoreInitial: true,
        ignored: ignoreFilter,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      sourceWatcher.on('change', (path) => {
        debouncedExtractor?.add(path);
      });

      sourceWatcher.on('add', (path) => {
        debouncedExtractor?.add(path);
      });
    }
  }

  return async function createConfig(
    metroConfig: MetroConfig,
  ): Promise<MetroConfig> {
    // Determine project root
    projectRoot = metroConfig.projectRoot || process.cwd();

    // Compile translations at startup
    await compile();

    // Set up watching if enabled
    if (enableWatch) {
      setupWatcher();
    }

    // Ensure output directory is in watchFolders for Metro
    const resolvedOutputDir = resolve(projectRoot, outputDir);
    const existingWatchFolders = metroConfig.watchFolders || [];

    return {
      ...metroConfig,
      watchFolders: [...existingWatchFolders, resolvedOutputDir],
    };
  };
}
