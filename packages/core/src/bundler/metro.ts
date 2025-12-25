import { utimes } from 'fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import { join, resolve } from 'pathe';
import { compileTranslations } from '../compiler/compile';

export interface IdiomaMetroOptions {
  /** Directory containing .po files */
  localeDir: string;
  /** Output directory for compiled translations */
  outputDir: string;
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
 *   localeDir: './locales',
 *   outputDir: './src/idioma',
 *   defaultLocale: 'en',
 * })(config);
 */
export function withIdioma(
  options: IdiomaMetroOptions,
): (config: MetroConfig) => Promise<MetroConfig> {
  const {
    localeDir,
    outputDir,
    defaultLocale,
    locales,
    watch: enableWatch = true,
    useSuspense,
  } = options;

  let watcher: FSWatcher | null = null;
  let projectRoot = '';

  async function compile(): Promise<void> {
    try {
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
    if (watcher) return;

    const watchPath = resolve(projectRoot, localeDir, '**/*.po');

    watcher = watch(watchPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    watcher.on('change', handleFileChange);
    watcher.on('add', handleFileAdd);
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
