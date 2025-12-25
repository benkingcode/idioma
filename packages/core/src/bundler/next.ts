import { join } from 'path';
import type { NextConfig } from 'next';
import type { Compiler, Configuration as WebpackConfiguration } from 'webpack';
import { compileTranslations } from '../compiler/compile.js';
import { ensureGitignore } from '../utils/gitignore.js';

export interface IdiomaNextOptions {
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
  /**
   * Enable Suspense-based lazy loading.
   * Requires React 19+.
   * @default false
   */
  useSuspense?: boolean;
}

interface WebpackContext {
  dev: boolean;
  isServer: boolean;
}

interface IdiomaWebpackPluginOptions {
  idiomaDir: string;
  localeDir: string;
  outputDir: string;
  defaultLocale: string;
  locales?: string[];
  useSuspense?: boolean;
  dev: boolean;
  projectRoot: string;
  hasCustomLocalesDir: boolean;
}

/**
 * Webpack plugin that compiles translations and watches for PO file changes.
 */
class IdiomaWebpackPlugin {
  private options: IdiomaWebpackPluginOptions;
  private hasCompiled = false;

  constructor(options: IdiomaWebpackPluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler) {
    const pluginName = 'IdiomaWebpackPlugin';

    // Compile before the build starts
    compiler.hooks.beforeCompile.tapAsync(
      pluginName,
      async (_params: unknown, callback: (err?: Error) => void) => {
        if (this.hasCompiled) {
          callback();
          return;
        }

        try {
          // Ensure .gitignore exists (skip creating locales/ if custom path provided)
          await ensureGitignore(this.options.idiomaDir, {
            skipLocalesDir: this.options.hasCustomLocalesDir,
          });

          await compileTranslations({
            localeDir: this.options.localeDir,
            outputDir: this.options.outputDir,
            defaultLocale: this.options.defaultLocale,
            locales: this.options.locales,
            useSuspense: this.options.useSuspense,
            projectRoot: this.options.projectRoot,
          });

          this.hasCompiled = true;
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    );

    // In dev mode, watch for PO file changes
    if (this.options.dev) {
      compiler.hooks.watchRun.tapAsync(
        pluginName,
        async (watching: Compiler, callback: (err?: Error) => void) => {
          const changedFiles = watching.modifiedFiles ?? new Set<string>();
          const hasPoChanges = [...changedFiles].some((f) => f.endsWith('.po'));

          if (hasPoChanges) {
            try {
              await compileTranslations({
                localeDir: this.options.localeDir,
                outputDir: this.options.outputDir,
                defaultLocale: this.options.defaultLocale,
                locales: this.options.locales,
                useSuspense: this.options.useSuspense,
                projectRoot: this.options.projectRoot,
              });
            } catch (error) {
              console.error('[idioma] Recompilation error:', error);
            }
          }

          callback();
        },
      );
    }
  }
}

/**
 * Next.js plugin for Idioma i18n.
 *
 * Features:
 * - Compiles PO files on build start
 * - Watches PO files for changes in dev mode
 * - Works with both App Router and Pages Router
 *
 * @example
 * // next.config.mjs
 * import { withIdioma } from '@idioma/core/next';
 *
 * export default withIdioma({
 *   idiomaDir: './src/idioma',
 *   defaultLocale: 'en',
 * })({
 *   // your other Next.js config
 * });
 */
export function withIdioma(
  options: IdiomaNextOptions,
): (nextConfig?: NextConfig) => NextConfig {
  const { idiomaDir, localesDir, defaultLocale, locales, useSuspense } =
    options;

  // Compute derived paths
  const localeDir = localesDir ?? join(idiomaDir, 'locales');
  const outputDir = idiomaDir;
  const hasCustomLocalesDir = !!localesDir;

  let pluginAdded = false;
  const projectRoot = process.cwd();

  return function createNextConfig(nextConfig: NextConfig = {}): NextConfig {
    return {
      ...nextConfig,

      webpack(
        config: WebpackConfiguration,
        context: WebpackContext,
      ): WebpackConfiguration {
        const { dev } = context;

        // Only add plugin once across multiple webpack calls
        if (!pluginAdded) {
          pluginAdded = true;

          config.plugins = config.plugins ?? [];
          config.plugins.push(
            new IdiomaWebpackPlugin({
              idiomaDir,
              localeDir,
              outputDir,
              defaultLocale,
              locales,
              useSuspense,
              dev,
              projectRoot,
              hasCustomLocalesDir,
            }),
          );
        }

        // Chain with existing webpack config if provided
        if (typeof nextConfig.webpack === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return nextConfig.webpack(config, context as any);
        }

        return config;
      },
    };
  };
}
