import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Plugin, ResolvedConfig } from 'vite';
import { loadConfig } from '../cli/config.js';
import {
  createCompileLock,
  type RoutingCompileOptions,
} from '../compiler/compile.js';
import { detectFramework } from '../framework.js';
import { ensureGitignore } from '../utils/gitignore.js';
import {
  createDebouncedExtractor,
  type DebouncedExtractor,
} from './debounce.js';
import { shouldIgnorePath } from './ignore-patterns.js';
import { extractAndMergeFile } from './incremental-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface IdiomiViteOptions {
  /**
   * Base directory for Idiomi files.
   * Generated files go in {idiomiDir}/, PO files in {idiomiDir}/locales/ by default.
   */
  idiomiDir?: string;
  /**
   * Directory containing PO files.
   * Override this if you have existing PO files elsewhere.
   * @default '{idiomiDir}/locales'
   */
  localesDir?: string;
  /** Default/source locale */
  defaultLocale?: string;
  /** List of supported locales (auto-detected from PO files if not specified) */
  locales?: string[];
  /** Watch for changes in development (default: true in dev mode) */
  watch?: boolean;
  /**
   * Enable Suspense-based lazy loading.
   * When true, generates chunk files for dynamic imports.
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

/**
 * Vite plugin for Idiomi i18n.
 *
 * Automatically loads configuration from idiomi.config.ts if no options provided.
 *
 * Features:
 * - Compiles PO files on build start
 * - Watches PO files for changes in dev mode
 * - Injects Babel plugin for Trans/useT transformation
 * - Triggers HMR when translations change
 * - Supports Suspense mode for lazy loading translations
 *
 * @example
 * // Auto-load from idiomi.config.ts
 * idiomi()
 *
 * // Or provide options directly
 * idiomi({ idiomiDir: './src/idiomi', defaultLocale: 'en' })
 */
export default function idiomiVitePlugin(
  options: IdiomiViteOptions = {},
): Plugin {
  const { watch, ignorePatterns } = options;

  // These are populated from config in buildStart
  let idiomiDir: string;
  let localeDir: string;
  let outputDir: string;
  let defaultLocale: string;
  let locales: string[] | undefined;
  let useSuspense: boolean | undefined;
  let hasCustomLocalesDir = false;
  let routingOptions: RoutingCompileOptions | undefined;

  let isDevMode = false;
  let projectRoot = '';
  // Use a stable object reference so Babel plugin always sees updates
  // (reactBabel callback captures this by reference at config time)
  const loadedTranslations: Record<string, Record<string, unknown>> = {};
  let debouncedExtractor: DebouncedExtractor | null = null;

  // Compile lock prevents concurrent compilations from racing
  const compileLock = createCompileLock();

  async function loadIdiomiConfig() {
    // Load config from idiomi.config.ts, with options as overrides
    const config = await loadConfig(projectRoot);

    idiomiDir = options.idiomiDir ?? config.idiomiDir;
    localeDir =
      options.localesDir ?? config.localesDir ?? join(idiomiDir, 'locales');
    outputDir = idiomiDir;
    defaultLocale = options.defaultLocale ?? config.defaultLocale;
    locales = options.locales ?? config.locales;
    useSuspense = options.useSuspense ?? config.useSuspense;
    hasCustomLocalesDir = !!(options.localesDir ?? config.localesDir);

    // Load routing options if configured
    if (config.routing) {
      const framework = await detectFramework(projectRoot);
      routingOptions = {
        enabled: true,
        localizedPaths: config.routing.localizedPaths ?? false,
        framework,
        metadataBase: config.routing.metadataBase,
        prefixStrategy: config.routing.prefixStrategy,
        detection: config.routing.detection,
      };
    }
  }

  async function compile() {
    try {
      // Ensure .gitignore exists (skip creating locales/ if custom path provided)
      await ensureGitignore(idiomiDir, { skipLocalesDir: hasCustomLocalesDir });

      // Use compile lock to prevent concurrent compilations from racing
      await compileLock.compile({
        localeDir,
        outputDir,
        defaultLocale,
        useSuspense,
        locales,
        projectRoot,
        routing: routingOptions,
      });
    } catch (error) {
      console.error('[idiomi] Compilation error:', error);
    }
  }

  return {
    name: 'idiomi',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      isDevMode = resolvedConfig.command === 'serve';
      projectRoot = resolvedConfig.root;
    },

    async buildStart() {
      // Load idiomi config (from idiomi.config.ts or options)
      await loadIdiomiConfig();

      // Compile translations at build start
      await compile();

      // Load compiled translations for Babel plugin (inlined mode only)
      // In suspense mode, both Trans and useT use lazy loading via dynamic imports
      if (!useSuspense) {
        try {
          const translationsPath = join(
            projectRoot,
            outputDir,
            '.generated',
            'translations.js',
          );
          // Use cache-busting query param for dev mode to pick up HMR changes
          const cacheBuster = isDevMode ? `?t=${Date.now()}` : '';
          const module = await import(translationsPath + cacheBuster);
          // Mutate the existing object so Babel plugin sees updates
          for (const key of Object.keys(loadedTranslations)) {
            delete loadedTranslations[key];
          }
          Object.assign(loadedTranslations, module.translations);
        } catch (error) {
          // Translations may not exist yet on first build
          console.warn('[idiomi] Could not load translations:', error);
        }
      }

      // Set up incremental extraction in dev mode
      if (isDevMode && watch !== false) {
        debouncedExtractor = createDebouncedExtractor(
          async (files) => {
            for (const file of files) {
              await extractAndMergeFile({
                filePath: file,
                projectRoot,
                idiomiDir: join(projectRoot, idiomiDir),
                localeDir: join(projectRoot, localeDir),
                defaultLocale,
                locales: locales ?? [defaultLocale],
              });
            }
            // Recompile after extraction
            await compile();
          },
          {
            delay: 200,
            onComplete: ({ files }) => {
              console.log(`[idiomi] Extracted from ${files.length} file(s)`);
            },
            onError: (error) => {
              console.error('[idiomi] Extraction error:', error);
            },
          },
        );
      }
    },

    // Handle HMR for PO files and source files
    handleHotUpdate({ file, server }) {
      // Handle PO file changes - recompile translations
      if (file.endsWith('.po') && file.includes(localeDir)) {
        compile().then(async () => {
          // Reload translations for Babel plugin (inlined mode only)
          if (!useSuspense) {
            try {
              const translationsPath = join(
                projectRoot,
                outputDir,
                '.generated',
                'translations.js',
              );
              const cacheBuster = `?t=${Date.now()}`;
              const module = await import(translationsPath + cacheBuster);
              // Mutate the existing object so Babel plugin sees updates
              for (const key of Object.keys(loadedTranslations)) {
                delete loadedTranslations[key];
              }
              Object.assign(loadedTranslations, module.translations);
            } catch (error) {
              console.warn('[idiomi] Could not reload translations:', error);
            }
          }

          // Invalidate all modules to force re-transformation with fresh translations
          // We need to invalidate because Babel inlines translations at transform time
          server.moduleGraph.invalidateAll();

          server.ws.send({
            type: 'full-reload',
            path: '*',
          });
        });
        return [];
      }

      // Handle source file changes - queue for incremental extraction
      // Uses .gitignore patterns automatically
      const matchesSourcePattern = /\.(tsx?|jsx?)$/.test(file);
      const isIgnored = shouldIgnorePath(file, projectRoot, ignorePatterns);
      // Skip files inside idiomiDir (those are generated, not user source)
      const absIdiomiDir = join(projectRoot, idiomiDir);
      const isInsideIdiomiDir = file.startsWith(absIdiomiDir);
      const isSourceFile =
        matchesSourcePattern && !isIgnored && !isInsideIdiomiDir;

      if (isSourceFile && debouncedExtractor) {
        debouncedExtractor.add(file);
        // Don't block HMR - extraction happens async
      }
    },

    // Inject Babel plugin for all builds (dev and production)
    api: {
      reactBabel(babelConfig: { plugins: unknown[] }) {
        const pluginOptions: Record<string, unknown> = {
          // Use 'suspense' for lazy loading, 'inlined' for baked-in translations
          mode: useSuspense ? 'suspense' : 'inlined',
          // Pass idiomiDir for robust config-based import detection
          idiomiDir: join(projectRoot, idiomiDir),
        };

        // Pass loaded translations for inlining (inlined mode only)
        // This is a stable reference - HMR updates mutate the same object
        if (!useSuspense) {
          pluginOptions.translations = loadedTranslations;
        }

        // Add suspense-specific options
        if (useSuspense) {
          pluginOptions.locales = locales;
          pluginOptions.outputDir = outputDir;
          pluginOptions.projectRoot = projectRoot;
        }

        babelConfig.plugins.push([
          join(__dirname, '../babel/plugin.mjs'),
          pluginOptions,
        ]);
      },
    },
  };
}
