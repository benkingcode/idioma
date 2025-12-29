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

  return {
    plugins: [
      [
        pluginPath,
        {
          mode,
          ...options,
        },
      ],
    ],
  };
}
