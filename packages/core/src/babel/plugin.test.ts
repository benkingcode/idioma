import { describe, it, expect } from 'vitest'
import * as babel from '@babel/core'
import idiomaPlugin, { type IdiomaPluginOptions } from './plugin'

function transform(code: string, options: IdiomaPluginOptions = {}): string {
  const result = babel.transformSync(code, {
    presets: ['@babel/preset-react', '@babel/preset-typescript'],
    plugins: [[idiomaPlugin, options]],
    filename: 'test.tsx',
  })

  return result?.code || ''
}

describe('Idioma Babel Plugin', () => {
  describe('development mode', () => {
    it('leaves Trans component unchanged in dev mode', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `

      const result = transform(code, { mode: 'development' })

      // After Babel, JSX becomes React.createElement
      // In dev mode, Trans should remain as Trans (not __Trans)
      expect(result).toContain('Trans')
      expect(result).toContain('Hello world')
      expect(result).not.toContain('__Trans')
    })

    it('leaves useT unchanged in dev mode', () => {
      const code = `
        import { useT } from './idioma'
        const t = useT()
      `

      const result = transform(code, { mode: 'development' })

      expect(result).toContain('useT()')
      expect(result).not.toContain('__useT')
    })
  })

  describe('production mode', () => {
    it('transforms Trans to __Trans with translations', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `

      const result = transform(code, {
        mode: 'production',
        translations: {
          '00000000': { // key for "Hello world"
            en: 'Hello world',
            es: 'Hola mundo',
          },
        },
      })

      expect(result).toContain('__Trans')
      expect(result).toContain('__t')
    })

    it('transforms Trans with interpolation', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello {name}</Trans>
      `

      const result = transform(code, {
        mode: 'production',
        translations: {},
      })

      expect(result).toContain('__Trans')
      expect(result).toContain('__a')
    })

    it('transforms Trans with components', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Click <Link>here</Link></Trans>
      `

      const result = transform(code, {
        mode: 'production',
        translations: {},
      })

      expect(result).toContain('__Trans')
      expect(result).toContain('__c')
    })

    it('handles Trans with explicit id', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans id="greeting">Hello</Trans>
      `

      const result = transform(code, {
        mode: 'production',
        translations: {
          greeting: {
            en: 'Hello',
            es: 'Hola',
          },
        },
      })

      expect(result).toContain('__Trans')
      // The translations are looked up by key and inlined
      expect(result).toContain('Hola')
    })

    it('transforms import from @idioma/react to include runtime', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello</Trans>
      `

      const result = transform(code, {
        mode: 'production',
        translations: {},
      })

      // Should import __Trans from runtime
      expect(result).toContain('__Trans')
    })
  })

  describe('extraction', () => {
    it('extracts messages from Trans components', () => {
      const extracted: Array<{ key: string; source: string }> = []

      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      })

      expect(extracted).toHaveLength(1)
      expect(extracted[0].source).toBe('Hello world')
    })

    it('extracts multiple messages', () => {
      const extracted: Array<{ key: string; source: string }> = []

      const code = `
        import { Trans } from '@idioma/react'
        const x = (
          <div>
            <Trans>First</Trans>
            <Trans>Second</Trans>
          </div>
        )
      `

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      })

      expect(extracted).toHaveLength(2)
    })
  })
})
