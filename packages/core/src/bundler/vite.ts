import { join } from 'path';
import type { Plugin, ResolvedConfig } from 'vite';
import { compileTranslations } from '../compiler/compile';
import { ensureGitignore } from '../utils/gitignore';

export interface IdiomaViteOptions {
  /**
   * Base directory for Idioma files.
   * PO files are in {idiomaDir}/locales/, generated files in {idiomaDir}/
   */
  idiomaDir: string;
  /** Default/source locale */
  defaultLocale: string;
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
 * Features:
 * - Compiles PO files on build start
 * - Watches PO files for changes in dev mode
 * - Injects Babel plugin for Trans/useT transformation
 * - Triggers HMR when translations change
 * - Supports Suspense mode for lazy loading translations
 */
export default function idiomaVitePlugin(options: IdiomaViteOptions): Plugin {
  const { idiomaDir, defaultLocale, locales, watch, useSuspense } = options;

  // Compute derived paths
  const localeDir = join(idiomaDir, 'locales');
  const outputDir = idiomaDir;

  let config: ResolvedConfig;
  let isDevMode = false;
  let projectRoot = '';

  async function compile() {
    try {
      // Ensure .gitignore exists
      await ensureGitignore(idiomaDir);

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
      config = resolvedConfig;
      isDevMode = resolvedConfig.command === 'serve';
      projectRoot = resolvedConfig.root;
    },

    async buildStart() {
      // Compile translations at build start
      await compile();

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

    // Inject Babel plugin for production builds
    api: {
      reactBabel(babelConfig: { plugins: unknown[] }) {
        if (!isDevMode) {
          // In production, add the idioma Babel plugin
          const pluginOptions: Record<string, unknown> = {
            mode: 'production',
          };

          // Add suspense-specific options
          if (useSuspense) {
            pluginOptions.useSuspense = true;
            pluginOptions.locales = locales;
            pluginOptions.outputDir = outputDir;
            pluginOptions.projectRoot = projectRoot;
          }

          babelConfig.plugins.push([
            require.resolve('../babel/plugin'),
            pluginOptions,
          ]);
        }
      },
    },
  };
}
