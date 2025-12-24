import type { Plugin, ResolvedConfig } from 'vite'
import { compileTranslations } from '../compiler/compile'

export interface IdiomaViteOptions {
  /** Directory containing .po files */
  localeDir: string
  /** Output directory for compiled translations */
  outputDir: string
  /** Default/source locale */
  defaultLocale: string
  /** List of supported locales (auto-detected from PO files if not specified) */
  locales?: string[]
  /** Watch for changes in development (default: true in dev mode) */
  watch?: boolean
}

/**
 * Vite plugin for Idioma i18n.
 *
 * Features:
 * - Compiles PO files on build start
 * - Watches PO files for changes in dev mode
 * - Injects Babel plugin for Trans/useT transformation
 * - Triggers HMR when translations change
 */
export default function idiomaVitePlugin(options: IdiomaViteOptions): Plugin {
  const { localeDir, outputDir, defaultLocale, watch } = options

  let config: ResolvedConfig
  let isDevMode = false

  async function compile() {
    try {
      await compileTranslations({
        localeDir,
        outputDir,
        defaultLocale,
      })
    } catch (error) {
      console.error('[idioma] Compilation error:', error)
    }
  }

  return {
    name: 'idioma',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig
      isDevMode = resolvedConfig.command === 'serve'
    },

    async buildStart() {
      // Compile translations at build start
      await compile()

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
          })
        })

        return []
      }
    },

    // Inject Babel plugin for production builds
    api: {
      reactBabel(babelConfig: { plugins: unknown[] }) {
        if (!isDevMode) {
          // In production, add the idioma Babel plugin
          babelConfig.plugins.push([
            require.resolve('../babel/plugin'),
            { mode: 'production' },
          ])
        }
      },
    },
  }
}
