import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Plugin, ResolvedConfig } from 'vite';
import { loadConfig } from '../cli/config.js';
import { compileTranslations } from '../compiler/compile.js';
import { ensureGitignore } from '../utils/gitignore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface IdiomaViteOptions {
  /**
   * Base directory for Idioma files.
   * Generated files go in {idiomaDir}/, PO files in {idiomaDir}/locales/ by default.
   */
  idiomaDir?: string;
  /**
   * Directory containing PO files.
   * Override this if you have existing PO files elsewhere.
   * @default '{idiomaDir}/locales'
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
}

/**
 * Vite plugin for Idioma i18n.
 *
 * Automatically loads configuration from idioma.config.ts if no options provided.
 *
 * Features:
 * - Compiles PO files on build start
 * - Watches PO files for changes in dev mode
 * - Injects Babel plugin for Trans/useT transformation
 * - Triggers HMR when translations change
 * - Supports Suspense mode for lazy loading translations
 *
 * @example
 * // Auto-load from idioma.config.ts
 * idioma()
 *
 * // Or provide options directly
 * idioma({ idiomaDir: './src/idioma', defaultLocale: 'en' })
 */
export default function idiomaVitePlugin(
  options: IdiomaViteOptions = {},
): Plugin {
  const { watch } = options;

  // These are populated from config in buildStart
  let idiomaDir: string;
  let localeDir: string;
  let outputDir: string;
  let defaultLocale: string;
  let locales: string[] | undefined;
  let useSuspense: boolean | undefined;
  let hasCustomLocalesDir = false;

  let isDevMode = false;
  let projectRoot = '';
  let loadedTranslations: Record<string, Record<string, unknown>> | undefined;

  async function loadIdiomaConfig() {
    // Load config from idioma.config.ts, with options as overrides
    const config = await loadConfig(projectRoot);

    idiomaDir = options.idiomaDir ?? config.idiomaDir;
    localeDir =
      options.localesDir ?? config.localesDir ?? join(idiomaDir, 'locales');
    outputDir = idiomaDir;
    defaultLocale = options.defaultLocale ?? config.defaultLocale;
    locales = options.locales ?? config.locales;
    useSuspense = options.useSuspense ?? config.useSuspense;
    hasCustomLocalesDir = !!(options.localesDir ?? config.localesDir);
  }

  async function compile() {
    try {
      // Ensure .gitignore exists (skip creating locales/ if custom path provided)
      await ensureGitignore(idiomaDir, { skipLocalesDir: hasCustomLocalesDir });

      await compileTranslations({
        localeDir,
        outputDir,
        defaultLocale,
        useSuspense,
        locales,
        projectRoot,
      });
    } catch (error) {
      console.error('[idioma] Compilation error:', error);
    }
  }

  return {
    name: 'idioma',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      isDevMode = resolvedConfig.command === 'serve';
      projectRoot = resolvedConfig.root;
    },

    async buildStart() {
      // Load idioma config (from idioma.config.ts or options)
      await loadIdiomaConfig();

      // Compile translations at build start
      await compile();

      // Load compiled translations for Babel plugin (non-suspense mode only)
      // In suspense mode, Trans uses lazy loading and useT is not yet supported
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
          loadedTranslations = module.translations;
        } catch (error) {
          // Translations may not exist yet on first build
          console.warn('[idioma] Could not load translations:', error);
        }
      }

      // Set up file watching in dev mode
      if (isDevMode && watch !== false) {
        // In a real implementation, we'd use chokidar here
        // For now, we rely on Vite's HMR for the output files
      }
    },

    // Handle HMR for PO files
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.po') && file.includes(localeDir)) {
        // Recompile and trigger full reload
        compile().then(() => {
          server.ws.send({
            type: 'full-reload',
            path: '*',
          });
        });

        return [];
      }
    },

    // Inject Babel plugin for all builds (dev and production)
    api: {
      reactBabel(babelConfig: { plugins: unknown[] }) {
        // Always use production mode to enable Trans transformations
        // (this is needed for locale switching to work in dev)
        const pluginOptions: Record<string, unknown> = {
          mode: 'production',
          // Pass idiomaDir for robust config-based import detection
          idiomaDir: join(projectRoot, idiomaDir),
        };

        // Pass loaded translations for inlining (non-suspense mode)
        if (!useSuspense && loadedTranslations) {
          pluginOptions.translations = loadedTranslations;
        }

        // Add suspense-specific options
        if (useSuspense) {
          pluginOptions.useSuspense = true;
          pluginOptions.locales = locales;
          pluginOptions.outputDir = outputDir;
          pluginOptions.projectRoot = projectRoot;
        }

        babelConfig.plugins.push([
          join(__dirname, '../babel/plugin.js'),
          pluginOptions,
        ]);
      },
    },
  };
}
