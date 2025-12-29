import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import type { generateText as generateTextFn, LanguageModel } from 'ai';
import { createJiti } from 'jiti';
import { z } from 'zod';

/** Re-export LanguageModel for users to reference in their config */
export type { LanguageModel } from 'ai';

/** Provider options type extracted from generateText parameters */
export type ProviderOptions = Parameters<
  typeof generateTextFn
>[0]['providerOptions'];

/** AI configuration schema - uses z.any() since LanguageModel can't be validated at runtime */
const AiConfigSchema = z
  .object({
    model: z.any().optional() as z.ZodOptional<z.ZodType<LanguageModel>>,
    guidelines: z.string().optional(),
    providerOptions: z.any().optional() as z.ZodOptional<
      z.ZodType<ProviderOptions>
    >,
  })
  .optional();

/** Locale detection configuration */
const DetectionConfigSchema = z.object({
  /** Cookie name for storing locale preference */
  cookieName: z.string().default('IDIOMA_LOCALE'),
  /** Detection priority order */
  order: z
    .array(z.enum(['cookie', 'header', 'path']))
    .default(['cookie', 'header']),
});

/** Routing configuration for localized paths */
const RoutingConfigSchema = z
  .object({
    /**
     * Base URL for absolute hreflang links and canonical URLs.
     * Matches Next.js Metadata API naming convention.
     * When omitted, relative URLs are used (e.g., /es/about).
     * @example 'https://example.com'
     */
    metadataBase: z.string().optional(),
    /**
     * Enable localized pathnames (e.g., /es/sobre instead of /es/about).
     * When enabled, route segments are extracted to PO files for translation.
     * @default false
     */
    localizedPaths: z.boolean().default(false),
    /**
     * Locale prefix strategy for URLs.
     * - 'always': All locales prefixed (e.g., /en/about, /es/about)
     * - 'as-needed': Default locale unprefixed (e.g., /about, /es/about)
     * @default 'as-needed'
     */
    prefixStrategy: z.enum(['always', 'as-needed']).default('as-needed'),
    /**
     * Glob patterns for routes to exclude from localization.
     * @default ['api/**', '_next/**']
     */
    exclude: z.array(z.string()).default(['api/**', '_next/**']),
    /**
     * Locale detection settings for middleware.
     */
    detection: DetectionConfigSchema.optional(),
  })
  .optional();

/**
 * Zod schema for Idiomi configuration.
 * This is the single source of truth - IdiomiConfig type is derived from this.
 */
const IdiomiConfigSchema = z.object({
  /**
   * Base directory for Idiomi files.
   * Generated files go in {idiomiDir}/, PO files in {idiomiDir}/locales/ by default.
   */
  idiomiDir: z.string().min(1, 'idiomiDir is required'),
  /**
   * Directory containing PO files.
   * Override this if you have existing PO files elsewhere.
   * @default '{idiomiDir}/locales'
   */
  localesDir: z.string().optional(),
  /** Default/source locale */
  defaultLocale: z.string().min(1, 'defaultLocale is required'),
  /** List of supported locales (auto-detected from PO files if not specified) */
  locales: z.array(z.string()).optional(),
  /**
   * List of namespaces (auto-detected from {locale}/*.po subdirectories if not specified).
   * Namespaces allow organizing translations into logical groups.
   */
  namespaces: z.array(z.string()).optional(),
  /** Glob patterns for source files to extract from */
  sourcePatterns: z.array(z.string()).optional(),
  /**
   * Enable Suspense-based lazy loading.
   * When false: All locales inlined, instant switching, larger bundles
   * When true: Dynamic imports, Suspense-compatible, smaller bundles
   * Requires React 19+.
   * @default false
   */
  useSuspense: z.boolean().optional(),
  /**
   * AI translation provider configuration.
   * Uses the Vercel AI SDK - install your preferred provider package (e.g., @ai-sdk/anthropic).
   */
  ai: AiConfigSchema,
  /**
   * Routing configuration for localized paths and middleware.
   * Used by @idiomi/next and @idiomi/tanstack-react packages.
   */
  routing: RoutingConfigSchema,
});

/** Idiomi configuration type - derived from the Zod schema */
export type IdiomiConfig = z.infer<typeof IdiomiConfigSchema>;

const DEFAULT_SOURCE_PATTERNS = ['**/*.tsx', '**/*.jsx', '**/*.ts', '**/*.js'];

/**
 * Type-safe config helper.
 * Use this in your idiomi.config.ts for autocomplete.
 */
export function defineConfig(config: IdiomiConfig): IdiomiConfig {
  return config;
}

/**
 * Compute derived paths from config.
 * - localeDir: where PO files are stored (override or {idiomiDir}/locales)
 * - outputDir: where generated files go (same as idiomiDir)
 */
export function getIdiomiPaths(config: IdiomiConfig): {
  localeDir: string;
  outputDir: string;
} {
  return {
    localeDir: config.localesDir ?? join(config.idiomiDir, 'locales'),
    outputDir: config.idiomiDir,
  };
}

/**
 * Load Idiomi configuration from a directory.
 * Looks for idiomi.config.ts or idiomi.config.js
 */
export async function loadConfig(cwd: string): Promise<IdiomiConfig> {
  const tsPath = join(cwd, 'idiomi.config.ts');
  const jsPath = join(cwd, 'idiomi.config.js');

  let configPath: string | null = null;

  // Check for .ts first (preferred)
  try {
    await fs.access(tsPath);
    configPath = tsPath;
  } catch {
    // Try .js
    try {
      await fs.access(jsPath);
      configPath = jsPath;
    } catch {
      // No config found
    }
  }

  if (!configPath) {
    throw new Error(
      `No idiomi config file found in ${cwd}. ` +
        `Create idiomi.config.ts or idiomi.config.js`,
    );
  }

  // Load the config using dynamic import
  const rawConfig = await loadConfigFile(configPath);

  // Validate config against schema
  const result = IdiomiConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid idiomi.config.ts:\n${issues}`);
  }

  const config = result.data;

  // Warn if defaultLocale is not in locales array (when locales specified)
  if (config.locales && !config.locales.includes(config.defaultLocale)) {
    console.warn(
      `[idiomi] Warning: defaultLocale "${config.defaultLocale}" ` +
        `is not in locales array [${config.locales.join(', ')}]`,
    );
  }

  // Merge with defaults
  return {
    ...config,
    sourcePatterns: config.sourcePatterns ?? DEFAULT_SOURCE_PATTERNS,
    useSuspense: config.useSuspense ?? false,
  };
}

async function loadConfigFile(configPath: string): Promise<unknown> {
  const absolutePath = resolve(configPath);

  // Use jiti to load TypeScript/JavaScript config files with proper import support
  const jiti = createJiti(absolutePath, {
    // Enable native ESM interop
    interopDefault: true,
  });

  const module = await jiti.import(absolutePath);
  return (module as { default?: unknown }).default ?? module;
}
