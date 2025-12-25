import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

export interface IdiomaConfig {
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
   * List of namespaces (auto-detected from {locale}/*.po subdirectories if not specified).
   * Namespaces allow organizing translations into logical groups.
   */
  namespaces?: string[];
  /** Glob patterns for source files to extract from */
  sourcePatterns?: string[];
  /**
   * Enable Suspense-based lazy loading.
   * When false: All locales inlined, instant switching, larger bundles
   * When true: Dynamic imports, Suspense-compatible, smaller bundles
   * Requires React 19+.
   * @default false
   */
  useSuspense?: boolean;
  /** AI translation provider configuration */
  ai?: {
    provider: 'anthropic' | 'openai';
    model?: string;
    apiKey?: string;
    /**
     * Project-specific guidelines for AI translation.
     * Describe your app's tone, audience, and any special requirements.
     * @example "This is a children's educational game. Use simple, friendly language."
     */
    guidelines?: string;
  };
}

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
  const config = await loadConfigFile(configPath);

  // Merge with defaults
  return {
    ...config,
    sourcePatterns: config.sourcePatterns ?? DEFAULT_SOURCE_PATTERNS,
    useSuspense: config.useSuspense ?? false,
  };
}

async function loadConfigFile(configPath: string): Promise<IdiomaConfig> {
  const absolutePath = resolve(configPath);

  if (configPath.endsWith('.ts')) {
    // For TypeScript, we need to use a bundler or ts-node
    // In a real implementation, we'd use jiti or tsx
    // For now, we'll use a simpler approach with eval
    const content = await fs.readFile(absolutePath, 'utf-8');

    // Simple transform: remove TypeScript-specific syntax
    const jsContent = content
      .replace(/export\s+default\s+/, 'module.exports = ')
      .replace(/:\s*IdiomaConfig/g, '')
      .replace(/import.*from.*['"].*['"]\s*;?\n?/g, '');

    // Create a temporary .mjs file
    const tempPath = absolutePath + '.mjs';
    const mjsContent = jsContent.replace(
      'module.exports = ',
      'export default ',
    );
    await fs.writeFile(tempPath, mjsContent);

    try {
      const fileUrl = pathToFileURL(tempPath).href;
      const module = await import(fileUrl);
      return module.default;
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  } else {
    // For JS, import directly
    const fileUrl = pathToFileURL(absolutePath).href;
    const module = await import(fileUrl);
    return module.default ?? module;
  }
}
