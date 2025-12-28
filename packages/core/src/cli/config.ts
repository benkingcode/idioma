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
 * Zod schema for Idioma configuration.
 * This is the single source of truth - IdiomaConfig type is derived from this.
 */
const IdiomaConfigSchema = z.object({
  /**
   * Base directory for Idioma files.
   * Generated files go in {idiomaDir}/, PO files in {idiomaDir}/locales/ by default.
   */
  idiomaDir: z.string().min(1, 'idiomaDir is required'),
  /**
   * Directory containing PO files.
   * Override this if you have existing PO files elsewhere.
   * @default '{idiomaDir}/locales'
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
   * Used by @idioma/next and @idioma/tanstack packages.
   */
  routing: RoutingConfigSchema,
});

/** Idioma configuration type - derived from the Zod schema */
export type IdiomaConfig = z.infer<typeof IdiomaConfigSchema>;

const DEFAULT_SOURCE_PATTERNS = ['**/*.tsx', '**/*.jsx', '**/*.ts', '**/*.js'];

/**
 * Type-safe config helper.
 * Use this in your idioma.config.ts for autocomplete.
 */
export function defineConfig(config: IdiomaConfig): IdiomaConfig {
  return config;
}

/**
 * Compute derived paths from config.
 * - localeDir: where PO files are stored (override or {idiomaDir}/locales)
 * - outputDir: where generated files go (same as idiomaDir)
 */
export function getIdiomaPaths(config: IdiomaConfig): {
  localeDir: string;
  outputDir: string;
} {
  return {
    localeDir: config.localesDir ?? join(config.idiomaDir, 'locales'),
    outputDir: config.idiomaDir,
  };
}

/**
 * Load Idioma configuration from a directory.
 * Looks for idioma.config.ts or idioma.config.js
 */
export async function loadConfig(cwd: string): Promise<IdiomaConfig> {
  const tsPath = join(cwd, 'idioma.config.ts');
  const jsPath = join(cwd, 'idioma.config.js');

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
      `No idioma config file found in ${cwd}. ` +
        `Create idioma.config.ts or idioma.config.js`,
    );
  }

  // Load the config using dynamic import
  const rawConfig = await loadConfigFile(configPath);

  // Validate config against schema
  const result = IdiomaConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid idioma.config.ts:\n${issues}`);
  }

  const config = result.data;

  // Warn if defaultLocale is not in locales array (when locales specified)
  if (config.locales && !config.locales.includes(config.defaultLocale)) {
    console.warn(
      `[idioma] Warning: defaultLocale "${config.defaultLocale}" ` +
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
