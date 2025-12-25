import type { IdiomaPluginOptions } from './plugin.js';

export interface IdiomaBabelPresetOptions {
  /** Enable Suspense-based lazy loading */
  useSuspense?: boolean;
  /** List of supported locales */
  locales?: string[];
  /** Output directory path for import paths */
  outputDir?: string;
  /** Project root for computing chunk IDs */
  projectRoot?: string;
}

type PluginEntry = [string, Partial<IdiomaPluginOptions>];

interface PresetResult {
  plugins: PluginEntry[];
}

/**
 * Babel preset for Idioma i18n.
 *
 * Automatically configures the Idioma Babel plugin with appropriate
 * mode based on NODE_ENV.
 *
 * @example
 * // babel.config.js
 * module.exports = {
 *   presets: [
 *     'next/babel',
 *     ['@idioma/core/babel-preset', {
 *       useSuspense: true,
 *       locales: ['en', 'es', 'fr'],
 *     }],
 *   ],
 * };
 */
export default function idiomaBabelPreset(
  _api?: unknown,
  options: IdiomaBabelPresetOptions = {},
): PresetResult {
  const mode =
    process.env.NODE_ENV === 'production' ? 'production' : 'development';

  // Use @idioma/core/babel which resolves to the plugin
  const pluginPath = '@idioma/core/babel';

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
