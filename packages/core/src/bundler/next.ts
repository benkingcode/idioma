import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NextConfig } from 'next';
import type { Compiler, Configuration as WebpackConfiguration } from 'webpack';
import {
  loadConfig,
  loadConfigSync,
  type IdiomiConfig,
} from '../cli/config.js';
import {
  compileTranslations,
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

/**
 * Next.js rewrite configuration object.
 * Defines a URL rewrite from source to destination.
 */
interface Rewrite {
  source: string;
  destination: string;
  /** Must be false to disable locale prefix handling in rewrites */
  locale?: false;
}

/**
 * Route map type: locale -> { canonicalPath: localizedPath }
 */
type RoutesMap = Record<string, Record<string, string>>;

/**
 * Reverse route map type: locale -> { localizedPath: canonicalPath }
 */
type ReverseRoutesMap = Record<string, Record<string, string>>;

/**
 * Parse the generated routes.js file synchronously.
 * Returns null if file doesn't exist or can't be parsed.
 */
function parseRoutesFile(
  routesPath: string,
): { routes: RoutesMap; reverseRoutes: ReverseRoutesMap } | null {
  if (!existsSync(routesPath)) {
    return null;
  }

  try {
    const content = readFileSync(routesPath, 'utf-8');

    // Parse the routes and reverseRoutes exports using regex
    // The file format is: export const routes = { ... }; export const reverseRoutes = { ... };
    const routesMatch = content.match(
      /export\s+const\s+routes\s*=\s*(\{[\s\S]*?\});/,
    );
    const reverseRoutesMatch = content.match(
      /export\s+const\s+reverseRoutes\s*=\s*(\{[\s\S]*?\});/,
    );

    if (!routesMatch || !reverseRoutesMatch) {
      return null;
    }

    // Use Function constructor to safely evaluate the object literals
    // This is safe because we control the file content
    const routes = new Function(`return ${routesMatch[1]}`)() as RoutesMap;
    const reverseRoutes = new Function(
      `return ${reverseRoutesMatch[1]}`,
    )() as ReverseRoutesMap;

    return { routes, reverseRoutes };
  } catch {
    return null;
  }
}

/**
 * Convert Next.js dynamic route syntax to rewrite patterns.
 * [slug] -> :slug
 * [...slug] -> :slug*
 * [[...slug]] -> :slug*
 */
function convertToRewritePattern(path: string): string {
  return path
    .replace(/\[\[\.\.\.(\w+)\]\]/g, ':$1*') // [[...slug]] -> :slug*
    .replace(/\[\.\.\.(\w+)\]/g, ':$1*') // [...slug] -> :slug*
    .replace(/\[(\w+)\]/g, ':$1'); // [slug] -> :slug
}

/**
 * Generate Next.js rewrites from the reverse routes map.
 * For Pages Router, localized paths need to be rewritten to canonical paths
 * so Next.js can find the page files.
 */
function generateRewrites(
  reverseRoutes: ReverseRoutesMap,
  locales: string[],
  defaultLocale: string,
): Rewrite[] {
  const rewrites: Rewrite[] = [];

  for (const locale of locales) {
    const localeRoutes = reverseRoutes[locale];
    if (!localeRoutes) continue;

    for (const [localizedPath, canonicalPath] of Object.entries(localeRoutes)) {
      // Skip if paths are the same (no translation needed)
      if (localizedPath === canonicalPath) continue;

      // Skip root path
      if (localizedPath === '/') continue;

      const sourcePattern = convertToRewritePattern(localizedPath);
      const destPattern = convertToRewritePattern(canonicalPath);

      // Add rewrite with locale prefix
      rewrites.push({
        source: `/${locale}${sourcePattern}`,
        destination: `/${locale}${destPattern}`,
        locale: false,
      });

      // For non-default locales, also add without prefix (for as-needed strategy)
      if (locale !== defaultLocale) {
        rewrites.push({
          source: sourcePattern,
          destination: destPattern,
          locale: false,
        });
      }
    }
  }

  return rewrites;
}

export interface IdiomiNextOptions {
  /**
   * Base directory for Idiomi files.
   * Generated files go in {idiomiDir}/, PO files in {idiomiDir}/locales/ by default.
   * Auto-loaded from idiomi.config.ts if not provided.
   */
  idiomiDir?: string;
  /**
   * Directory containing PO files.
   * Override this if you have existing PO files elsewhere.
   * @default '{idiomiDir}/locales'
   */
  localesDir?: string;
  /**
   * Default/source locale.
   * Auto-loaded from idiomi.config.ts if not provided.
   */
  defaultLocale?: string;
  /** List of supported locales (auto-detected from PO files if not specified) */
  locales?: string[];
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
   * Enable routing integration for localized Link component.
   * When true, generates a Link component in the idiomi/index.ts output.
   * Auto-loaded from idiomi.config.ts if not provided.
   */
  routing?: {
    /** Enable localized pathnames (e.g., /es/sobre instead of /es/about) */
    localizedPaths?: boolean;
    /** Base URL for absolute hreflang links and canonical URLs */
    metadataBase?: string;
    /** Locale prefix strategy for URLs */
    prefixStrategy?: 'always' | 'as-needed';
  };
}

interface WebpackContext {
  dev: boolean;
  isServer: boolean;
}

interface IdiomiWebpackPluginOptions {
  // User-provided options (optional - will be merged with loaded config)
  userOptions: IdiomiNextOptions;
  dev: boolean;
  projectRoot: string;
}

/**
 * Resolved options after merging user options with loaded config.
 */
interface ResolvedOptions {
  idiomiDir: string;
  localeDir: string;
  outputDir: string;
  defaultLocale: string;
  locales?: string[];
  useSuspense?: boolean;
  hasCustomLocalesDir: boolean;
  ignorePatterns?: string[];
  routing?: RoutingCompileOptions;
}

/**
 * Webpack plugin that compiles translations and watches for file changes.
 */
class IdiomiWebpackPlugin {
  private pluginOptions: IdiomiWebpackPluginOptions;
  private resolved: ResolvedOptions | null = null;
  private hasCompiled = false;
  private debouncedExtractor: DebouncedExtractor | null = null;

  constructor(options: IdiomiWebpackPluginOptions) {
    this.pluginOptions = options;
  }

  /**
   * Load and merge config from idiomi.config.ts with user options.
   */
  private async loadConfig(): Promise<ResolvedOptions> {
    const { userOptions, projectRoot } = this.pluginOptions;

    // Load config file
    let config: IdiomiConfig | null = null;
    try {
      config = await loadConfig(projectRoot);
    } catch {
      // Config file not found - that's okay if user provided all required options
    }

    // Merge options (user options override config file)
    const idiomiDir = userOptions.idiomiDir ?? config?.idiomiDir;
    if (!idiomiDir) {
      throw new Error(
        '[idiomi] Missing idiomiDir. Either provide it in withIdiomi() options or create idiomi.config.ts',
      );
    }

    const defaultLocale = userOptions.defaultLocale ?? config?.defaultLocale;
    if (!defaultLocale) {
      throw new Error(
        '[idiomi] Missing defaultLocale. Either provide it in withIdiomi() options or create idiomi.config.ts',
      );
    }

    const localesDir = userOptions.localesDir ?? config?.localesDir;
    const localeDir = localesDir ?? join(idiomiDir, 'locales');
    const hasCustomLocalesDir = !!localesDir;

    const locales = userOptions.locales ?? config?.locales;
    const useSuspense = userOptions.useSuspense ?? config?.useSuspense;
    const ignorePatterns = userOptions.ignorePatterns;

    // Merge routing options
    const routingConfig = userOptions.routing ?? config?.routing;
    let routing: RoutingCompileOptions | undefined;
    if (routingConfig) {
      routing = {
        enabled: true,
        localizedPaths: routingConfig.localizedPaths ?? false,
        framework: null, // Will be detected at compile time
        metadataBase: routingConfig.metadataBase,
        prefixStrategy: routingConfig.prefixStrategy,
      };
    }

    return {
      idiomiDir,
      localeDir,
      outputDir: idiomiDir,
      defaultLocale,
      locales,
      useSuspense,
      hasCustomLocalesDir,
      ignorePatterns,
      routing,
    };
  }

  private setupDebouncedExtractor(resolved: ResolvedOptions) {
    if (!this.pluginOptions.dev) return;

    this.debouncedExtractor = createDebouncedExtractor(
      async (files) => {
        for (const file of files) {
          await extractAndMergeFile({
            filePath: file,
            projectRoot: this.pluginOptions.projectRoot,
            idiomiDir: resolved.idiomiDir,
            localeDir: resolved.localeDir,
            defaultLocale: resolved.defaultLocale,
            locales: resolved.locales ?? [resolved.defaultLocale],
          });
        }
        // Recompile after extraction
        await compileTranslations({
          localeDir: resolved.localeDir,
          outputDir: resolved.outputDir,
          defaultLocale: resolved.defaultLocale,
          locales: resolved.locales,
          useSuspense: resolved.useSuspense,
          projectRoot: this.pluginOptions.projectRoot,
          routing: resolved.routing,
        });
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

  apply(compiler: Compiler) {
    const pluginName = 'IdiomiWebpackPlugin';

    // Compile before the build starts
    compiler.hooks.beforeCompile.tapAsync(
      pluginName,
      async (_params: unknown, callback: (err?: Error) => void) => {
        if (this.hasCompiled) {
          callback();
          return;
        }

        try {
          // Load and resolve config on first compile
          if (!this.resolved) {
            this.resolved = await this.loadConfig();
            this.setupDebouncedExtractor(this.resolved);
          }

          const resolved = this.resolved;

          // Ensure .gitignore exists (skip creating locales/ if custom path provided)
          await ensureGitignore(resolved.idiomiDir, {
            skipLocalesDir: resolved.hasCustomLocalesDir,
          });

          // Detect framework if routing is enabled but framework not yet detected
          let routing = resolved.routing;
          if (routing && !routing.framework) {
            const framework = await detectFramework(
              this.pluginOptions.projectRoot,
            );
            routing = { ...routing, framework };
            // Update resolved for future calls
            resolved.routing = routing;
          }

          await compileTranslations({
            localeDir: resolved.localeDir,
            outputDir: resolved.outputDir,
            defaultLocale: resolved.defaultLocale,
            locales: resolved.locales,
            useSuspense: resolved.useSuspense,
            projectRoot: this.pluginOptions.projectRoot,
            routing,
          });

          this.hasCompiled = true;
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    );

    // In dev mode, watch for file changes
    if (this.pluginOptions.dev) {
      compiler.hooks.watchRun.tapAsync(
        pluginName,
        async (watching: Compiler, callback: (err?: Error) => void) => {
          // Wait for config to be loaded
          if (!this.resolved) {
            callback();
            return;
          }

          const resolved = this.resolved;
          const changedFiles = watching.modifiedFiles ?? new Set<string>();

          // Handle PO file changes - recompile translations
          const hasPoChanges = [...changedFiles].some((f) => f.endsWith('.po'));
          if (hasPoChanges) {
            try {
              await compileTranslations({
                localeDir: resolved.localeDir,
                outputDir: resolved.outputDir,
                defaultLocale: resolved.defaultLocale,
                locales: resolved.locales,
                useSuspense: resolved.useSuspense,
                projectRoot: this.pluginOptions.projectRoot,
                routing: resolved.routing,
              });
            } catch (error) {
              console.error('[idiomi] Recompilation error:', error);
            }
          }

          // Handle source file changes - queue for incremental extraction
          // Uses .gitignore patterns automatically
          const sourceFiles = [...changedFiles].filter(
            (f) =>
              /\.(tsx?|jsx?)$/.test(f) &&
              !shouldIgnorePath(
                f,
                this.pluginOptions.projectRoot,
                resolved.ignorePatterns,
              ),
          );

          for (const file of sourceFiles) {
            this.debouncedExtractor?.add(file);
          }

          callback();
        },
      );
    }
  }
}

/**
 * Next.js plugin for Idiomi i18n.
 *
 * Automatically loads configuration from idiomi.config.ts if no options provided.
 *
 * Features:
 * - Compiles PO files on build start
 * - Watches PO files for changes in dev mode
 * - Works with both App Router and Pages Router
 * - Auto-generates rewrites for Pages Router with localized paths
 *
 * @example
 * // Auto-load from idiomi.config.ts
 * import { withIdiomi } from '@idiomi/core/next';
 *
 * export default withIdiomi()({
 *   // your other Next.js config
 * });
 *
 * @example
 * // Or provide options directly (overrides idiomi.config.ts)
 * import { withIdiomi } from '@idiomi/core/next';
 *
 * export default withIdiomi({
 *   idiomiDir: './src/idiomi',
 *   defaultLocale: 'en',
 * })({
 *   // your other Next.js config
 * });
 */
export function withIdiomi(
  options: IdiomiNextOptions = {},
): (nextConfig?: NextConfig) => NextConfig {
  let pluginAdded = false;
  const projectRoot = process.cwd();

  // Try to load config synchronously for rewrite generation
  let idiomiConfig: IdiomiConfig | null = null;
  try {
    idiomiConfig = loadConfigSync(projectRoot);
  } catch {
    // Config not found - will be loaded async later
  }

  return function createNextConfig(nextConfig: NextConfig = {}): NextConfig {
    // Check if this is Pages Router (has i18n config)
    const isPagesRouter = !!nextConfig.i18n;

    // For Pages Router with localized paths, we need to inject rewrites
    let generatedRewrites: Rewrite[] = [];
    if (isPagesRouter && idiomiConfig?.routing?.localizedPaths) {
      const idiomiDir = options.idiomiDir ?? idiomiConfig.idiomiDir;
      if (idiomiDir) {
        const routesPath = join(projectRoot, idiomiDir, '.generated/routes.js');
        const routesData = parseRoutesFile(routesPath);

        if (routesData && nextConfig.i18n) {
          // Spread to convert readonly string[] to string[]
          const locales = [...(nextConfig.i18n.locales ?? [])];
          const defaultLocale = nextConfig.i18n.defaultLocale ?? 'en';
          generatedRewrites = generateRewrites(
            routesData.reverseRoutes,
            locales,
            defaultLocale,
          );
        }
      }
    }

    // Build the enhanced config
    const enhancedConfig: NextConfig = {
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
            new IdiomiWebpackPlugin({
              userOptions: options,
              dev,
              projectRoot,
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

    // Add rewrites if we have generated ones for Pages Router
    if (generatedRewrites.length > 0) {
      enhancedConfig.rewrites = async () => {
        // Get user-defined rewrites if any
        const userRewrites = nextConfig.rewrites
          ? await nextConfig.rewrites()
          : null;

        // Normalize to object format
        const normalizedRewrites = Array.isArray(userRewrites)
          ? { beforeFiles: userRewrites, afterFiles: [], fallback: [] }
          : (userRewrites ?? { beforeFiles: [], afterFiles: [], fallback: [] });

        return {
          beforeFiles: [
            ...generatedRewrites,
            ...(normalizedRewrites.beforeFiles ?? []),
          ],
          afterFiles: normalizedRewrites.afterFiles ?? [],
          fallback: normalizedRewrites.fallback ?? [],
        };
      };
    }

    return enhancedConfig;
  };
}
