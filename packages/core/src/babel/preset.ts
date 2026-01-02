import { dirname, join } from 'path';
import { createJiti } from 'jiti';
import type { IdiomiPluginOptions } from './plugin.js';

export interface IdiomiBabelPresetOptions {
  /** Enable Suspense-based lazy loading */
  useSuspense?: boolean;
  /** List of supported locales */
  locales?: string[];
  /** Output directory path for import paths */
  outputDir?: string;
  /** Project root for computing chunk IDs */
  projectRoot?: string;
  /**
   * Absolute path to idiomi folder for robust import detection.
   * This enables config-based detection which handles import aliasing.
   */
  idiomiDir?: string;
}

type PluginEntry = [string, Partial<IdiomiPluginOptions>];

interface PresetResult {
  plugins: PluginEntry[];
}

/**
 * Load translations synchronously from the .generated folder.
 * Uses jiti to handle ESM/CJS interop.
 */
function loadTranslations(
  idiomiDir: string,
): Record<string, Record<string, string>> | null {
  try {
    const translationsPath = join(idiomiDir, '.generated', 'translations.js');
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const module = jiti(translationsPath) as {
      translations?: Record<string, Record<string, string>>;
    };
    return module.translations ?? null;
  } catch {
    // Translations may not exist yet
    return null;
  }
}

/**
 * Load config synchronously from the .generated folder.
 * Used to derive locales for suspense mode.
 */
function loadConfig(idiomiDir: string): { locales?: string[] } | null {
  try {
    const configPath = join(idiomiDir, '.generated', 'config.js');
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const module = jiti(configPath) as {
      locales?: string[];
    };
    return module;
  } catch {
    // Config may not exist yet
    return null;
  }
}

/**
 * Babel preset for Idiomi i18n.
 *
 * Configures the Idiomi Babel plugin with inlined or suspense mode.
 *
 * @example
 * // babel.config.js
 * const path = require('path');
 *
 * module.exports = {
 *   presets: [
 *     'next/babel',
 *     ['@idiomi/core/babel-preset', {
 *       // Enable robust import detection (handles aliased imports)
 *       idiomiDir: path.resolve(__dirname, './src/idiomi'),
 *       useSuspense: true,
 *       locales: ['en', 'es', 'fr'],
 *     }],
 *   ],
 * };
 */
export default function idiomiBabelPreset(
  _api?: unknown,
  options: IdiomiBabelPresetOptions = {},
): PresetResult {
  // Determine mode: 'suspense' for lazy loading, 'inlined' for baked-in translations
  const mode = options.useSuspense ? 'suspense' : 'inlined';

  // Use @idiomi/core/babel which resolves to the plugin
  const pluginPath = '@idiomi/core/babel';

  // Build plugin options
  const pluginOptions: Partial<IdiomiPluginOptions> = {
    mode,
    ...options,
  };

  // For inlined mode, load translations from the .generated folder
  if (mode === 'inlined' && options.idiomiDir) {
    const translations = loadTranslations(options.idiomiDir);
    if (translations) {
      pluginOptions.translations = translations;
    }
  }

  // For suspense mode, auto-derive missing options from idiomiDir
  if (mode === 'suspense' && options.idiomiDir) {
    // Set outputDir to idiomiDir if not provided
    if (!pluginOptions.outputDir) {
      pluginOptions.outputDir = options.idiomiDir;
    }

    // Derive projectRoot from idiomiDir (go up to find package.json level)
    // idiomiDir is typically like /path/to/project/src/idiomi
    if (!pluginOptions.projectRoot) {
      // Walk up to find a reasonable project root (directory containing idiomiDir)
      // A simple heuristic: the parent of idiomiDir's parent (e.g., /path/to/project from /path/to/project/src/idiomi)
      let dir = dirname(options.idiomiDir);
      // Go up one more level if we're in a src folder
      if (dir.endsWith('/src') || dir.endsWith('\\src')) {
        dir = dirname(dir);
      }
      pluginOptions.projectRoot = dir;
    }

    // Load locales from config if not provided
    if (!pluginOptions.locales) {
      const config = loadConfig(options.idiomiDir);
      if (config?.locales) {
        pluginOptions.locales = config.locales;
      }
    }
  }

  return {
    plugins: [[pluginPath, pluginOptions]],
  };
}
