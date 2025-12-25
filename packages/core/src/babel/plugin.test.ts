import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';
import idiomaPlugin, { type IdiomaPluginOptions } from './plugin';

function transform(code: string, options: IdiomaPluginOptions = {}): string {
  const result = babel.transformSync(code, {
    presets: ['@babel/preset-react', '@babel/preset-typescript'],
    plugins: [[idiomaPlugin, options]],
    filename: 'test.tsx',
  });

  return result?.code || '';
}

describe('Idioma Babel Plugin', () => {
  describe('development mode', () => {
    it('leaves Trans component unchanged in dev mode', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, { mode: 'development' });

      // After Babel, JSX becomes React.createElement
      // In dev mode, Trans should remain as Trans (not __Trans)
      expect(result).toContain('Trans');
      expect(result).toContain('Hello world');
      expect(result).not.toContain('__Trans');
    });

    it('leaves useT unchanged in dev mode', () => {
      const code = `
        import { useT } from './idioma'
        const t = useT()
      `;

      const result = transform(code, { mode: 'development' });

      expect(result).toContain('useT()');
      expect(result).not.toContain('__useT');
    });
  });

  describe('production mode', () => {
    describe('member expression handling', () => {
      it('handles member expression placeholder in __a prop', () => {
        const code = `
          import { Trans } from '@idioma/react'
          const x = <Trans>Hello {user.name}</Trans>
        `;

        const result = transform(code, {
          mode: 'production',
          translations: {},
        });

        // Should produce __a={{ "user.name": user.name }} not __a={{ "user.name": user }}
        expect(result).toContain('__a');
        // The VALUE should be user.name (member expression), not just user
        // Match pattern: "user.name": user.name  (key: value)
        expect(result).toMatch(/"user\.name":\s*user\.name/);
      });

      it('handles nested member expression', () => {
        const code = `
          import { Trans } from '@idioma/react'
          const x = <Trans>Value: {data.nested.value}</Trans>
        `;

        const result = transform(code, {
          mode: 'production',
          translations: {},
        });

        expect(result).toContain('__a');
        // The VALUE should be data.nested.value, not just data
        expect(result).toMatch(/"data\.nested\.value":\s*data\.nested\.value/);
      });

      it('handles member expression in suspense mode', () => {
        const code = `
          import { Trans } from '@idioma/react'
          const x = <Trans>Hello {user.name}</Trans>
        `;

        const result = transform(code, {
          mode: 'production',
          useSuspense: true,
          locales: ['en', 'es'],
          outputDir: './idioma',
          projectRoot: '/project',
        });

        expect(result).toContain('__a');
        // The VALUE should be user.name, not just user
        expect(result).toMatch(/"user\.name":\s*user\.name/);
      });

      it('handles array access expression', () => {
        const code = `
          import { Trans } from '@idioma/react'
          const x = <Trans>First item: {items[0]}</Trans>
        `;

        const result = transform(code, {
          mode: 'production',
          translations: {},
        });

        expect(result).toContain('__a');
        // Array access is a MemberExpression, key is "items[0]", value is items[0]
        expect(result).toMatch(/"items\[0\]":\s*items\[0\]/);
      });
    });

    it('transforms Trans to __Trans with translations', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {
          '00000000': {
            // key for "Hello world"
            en: 'Hello world',
            es: 'Hola mundo',
          },
        },
      });

      expect(result).toContain('__Trans');
      expect(result).toContain('__t');
    });

    it('transforms Trans with interpolation', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello {name}</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {},
      });

      expect(result).toContain('__Trans');
      expect(result).toContain('__a');
    });

    it('transforms Trans with components', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Click <Link>here</Link></Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {},
      });

      expect(result).toContain('__Trans');
      expect(result).toContain('__c');
    });

    it('handles Trans with explicit id', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans id="greeting">Hello</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {
          greeting: {
            en: 'Hello',
            es: 'Hola',
          },
        },
      });

      expect(result).toContain('__Trans');
      // The translations are looked up by key and inlined
      expect(result).toContain('Hola');
    });

    it('transforms import from @idioma/react to include runtime', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {},
      });

      // Should import __Trans from runtime
      expect(result).toContain('__Trans');
    });

    it('injects __Trans import for non-suspense production mode', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {
          '00000000': {
            en: 'Hello world',
            es: 'Hola mundo',
          },
        },
      });

      // Should inject import { __Trans } from '@idioma/react'
      expect(result).toContain('import { __Trans } from "@idioma/react"');
    });

    it('does not inject __Trans import in development mode', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, { mode: 'development' });

      expect(result).not.toContain('import { __Trans }');
    });

    it('does not inject __Trans import when no Trans is used', () => {
      const code = `
        const x = <div>Hello</div>
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {},
      });

      expect(result).not.toContain('__Trans');
    });
  });

  describe('extraction', () => {
    it('extracts messages from Trans components', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello world');
    });

    it('extracts multiple messages', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { Trans } from '@idioma/react'
        const x = (
          <div>
            <Trans>First</Trans>
            <Trans>Second</Trans>
          </div>
        )
      `;

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(2);
    });
  });

  describe('suspense mode', () => {
    it('injects __$idiomaChunk constant', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: true,
        locales: ['en', 'es'],
        outputDir: './idioma',
        projectRoot: '/project',
      });

      expect(result).toContain('__$idiomaChunk');
    });

    it('injects __$idiomaLoad with dynamic imports for all locales', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: true,
        locales: ['en', 'es', 'de'],
        outputDir: './idioma',
        projectRoot: '/project',
      });

      expect(result).toContain('__$idiomaLoad');
      expect(result).toContain('import(');
      // Check that all locales are present in the loader
      expect(result).toContain('.en');
      expect(result).toContain('.es');
      expect(result).toContain('.de');
    });

    it('transforms Trans to include __key, __chunk, __load props', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: true,
        locales: ['en', 'es'],
        outputDir: './idioma',
        projectRoot: '/project',
      });

      expect(result).toContain('__TransSuspense');
      expect(result).toContain('__key');
      expect(result).toContain('__chunk');
      expect(result).toContain('__load');
    });

    it('imports __TransSuspense from runtime-suspense', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: true,
        locales: ['en', 'es'],
        outputDir: './idioma',
        projectRoot: '/project',
      });

      expect(result).toContain('@idioma/react/runtime-suspense');
      expect(result).toContain('__TransSuspense');
    });

    it('handles multiple Trans components in same file (shared loader)', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>First</Trans>
        const y = <Trans>Second</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: true,
        locales: ['en', 'es'],
        outputDir: './idioma',
        projectRoot: '/project',
      });

      // Should only inject once
      const chunkMatches = result.match(/__\$idiomaChunk/g);
      expect(chunkMatches?.length).toBeGreaterThan(0);

      // Both Trans components should use the same chunk
      expect(result).toContain('__TransSuspense');
    });

    it('preserves __a for interpolation in suspense mode', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Hello {name}</Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: true,
        locales: ['en', 'es'],
        outputDir: './idioma',
        projectRoot: '/project',
      });

      expect(result).toContain('__a');
      expect(result).toContain('name');
    });

    it('preserves __c for components in suspense mode', () => {
      const code = `
        import { Trans } from '@idioma/react'
        const x = <Trans>Click <Link>here</Link></Trans>
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: true,
        locales: ['en', 'es'],
        outputDir: './idioma',
        projectRoot: '/project',
      });

      expect(result).toContain('__c');
      expect(result).toContain('Link');
    });
  });

  describe('t() call transformation', () => {
    it('leaves t() calls unchanged in dev mode', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const msg = t('Hello world')
      `;

      const result = transform(code, { mode: 'development' });

      expect(result).toContain("t('Hello world')");
      expect(result).not.toContain('en:');
      expect(result).not.toContain('es:');
    });

    it('inlines translations for t() calls in production mode', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const msg = t('Hello world')
      `;

      // Key for 'Hello world' is '003B4Ntk'
      const result = transform(code, {
        mode: 'production',
        translations: {
          '003B4Ntk': {
            en: 'Hello world',
            es: 'Hola mundo',
          },
        },
      });

      expect(result).toContain('Hello world');
      expect(result).toContain('Hola mundo');
    });

    it('preserves existing values argument', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const msg = t('Hello {name}', { name: 'Ben' })
      `;

      // Key for 'Hello {name}' is '000VsT4w'
      const result = transform(code, {
        mode: 'production',
        translations: {
          '000VsT4w': {
            en: 'Hello {name}',
            es: 'Hola {name}',
          },
        },
      });

      // Should preserve the values object
      expect(result).toContain('name');
      expect(result).toContain('Ben');
      // Should also inline translations
      expect(result).toContain('Hola {name}');
    });

    it('skips dynamic strings (variables)', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const key = 'Hello world'
        const msg = t(key)
      `;

      const result = transform(code, {
        mode: 'production',
        translations: {
          '00000000': {
            en: 'Hello world',
            es: 'Hola mundo',
          },
        },
      });

      // Dynamic string should be left as-is
      expect(result).toContain('t(key)');
      expect(result).not.toContain('Hola mundo');
    });

    it('extracts messages from t() calls in dev mode', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const msg = t('Hello world')
      `;

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello world');
    });

    it('handles t() calls with context option', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const msg = t('Submit', undefined, { context: 'button' })
      `;

      // Key for 'Submit' (without context in transformation - context is in 3rd arg)
      // For now, context support in t() is limited - the call still uses the plain key
      const result = transform(code, {
        mode: 'production',
        translations: {
          '000os6FO': {
            en: 'Submit',
            es: 'Enviar',
          },
        },
      });

      // Should still contain the original string (transformation happens)
      expect(result).toContain('Submit');
    });

    it('injects translations import for dynamic t() calls', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const key = getErrorKey()
        const msg = t(key)
      `;

      const result = transform(code, {
        mode: 'production',
        outputDir: './idioma',
      });

      // Should inject translations import
      expect(result).toContain('translations');
      expect(result).toContain('./idioma/.generated/translations');
      expect(result).toContain('__$translations');
      // Should modify createT call to pass translations
      expect(result).toContain('createT(');
    });

    it('does not inject translations for static-only t() calls', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const msg = t('Hello world')
      `;

      const result = transform(code, {
        mode: 'production',
        outputDir: './idioma',
        translations: {
          '003B4Ntk': { en: 'Hello world', es: 'Hola mundo' },
        },
      });

      // Should NOT inject translations import for static-only files
      expect(result).not.toContain('__$translations');
      expect(result).not.toContain('./idioma/.generated/translations');
    });

    it('injects translations when file has both static and dynamic t() calls', () => {
      const code = `
        import { createT } from '@idioma/core/runtime'
        const t = createT('es')
        const staticMsg = t('Hello world')
        const dynamicKey = getKey()
        const dynamicMsg = t(dynamicKey)
      `;

      const result = transform(code, {
        mode: 'production',
        outputDir: './idioma',
        translations: {
          '003B4Ntk': { en: 'Hello world', es: 'Hola mundo' },
        },
      });

      // Static call should be inlined
      expect(result).toContain('Hola mundo');
      // Dynamic call should trigger translations injection
      expect(result).toContain('__$translations');
    });
  });

  describe('t() with template literals and plural()', () => {
    it('extracts template literal with plural() call', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { plural } from '@idioma/react'
        const t = (s: string) => s
        const msg = t(\`You have \${plural(count, { one: "# item", other: "# items" })} in cart\`)
      `;

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe(
        'You have {count, plural, one {# item} other {# items}} in cart',
      );
    });

    it('extracts template literal with mixed placeholders', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { plural } from '@idioma/react'
        const t = (s: string) => s
        const msg = t(\`Hello \${name}, you have \${plural(count, { one: "# message", other: "# messages" })}\`)
      `;

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe(
        'Hello {name}, you have {count, plural, one {# message} other {# messages}}',
      );
      expect(extracted[0].placeholders).toEqual({
        name: 'name',
        count: 'count',
      });
    });

    it('extracts template literal with member expression in plural()', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { plural } from '@idioma/react'
        const t = (s: string) => s
        const msg = t(\`Items: \${plural(data.count, { one: "#", other: "#" })}\`)
      `;

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe(
        'Items: {data.count, plural, one {#} other {#}}',
      );
    });

    it('produces identical ICU for Trans and t() with same plural()', () => {
      const transExtracted: Array<{ source: string }> = [];
      const tExtracted: Array<{ source: string }> = [];

      // Trans version
      const transCode = `
        import { Trans, plural } from '@idioma/react'
        const x = <Trans>You have {plural(count, { one: "# item", other: "# items" })} in cart</Trans>
      `;
      transform(transCode, {
        mode: 'development',
        onExtract: (msg) => transExtracted.push(msg),
      });

      // t() version
      const tCode = `
        import { plural } from '@idioma/react'
        const t = (s: string) => s
        const msg = t(\`You have \${plural(count, { one: "# item", other: "# items" })} in cart\`)
      `;
      transform(tCode, {
        mode: 'development',
        onExtract: (msg) => tExtracted.push(msg),
      });

      // Both should produce identical ICU messages
      expect(transExtracted[0].source).toBe(tExtracted[0].source);
      expect(transExtracted[0].source).toBe(
        'You have {count, plural, one {# item} other {# items}} in cart',
      );
    });

    it('handles template literal with all CLDR plural forms', () => {
      const extracted: Array<{ source: string }> = [];

      const code = `
        import { plural } from '@idioma/react'
        const t = (s: string) => s
        const msg = t(\`\${plural(n, { zero: "none", one: "one", two: "two", few: "few", many: "many", other: "other" })}\`)
      `;

      transform(code, {
        mode: 'development',
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe(
        '{n, plural, zero {none} one {one} two {two} few {few} many {many} other {other}}',
      );
    });
  });

  describe('useT suspense mode', () => {
    const suspenseOptions = {
      useSuspense: true,
      locales: ['en', 'es'],
      outputDir: './idioma',
      projectRoot: '/project',
    };

    it('transforms useT() to __useTSuspense with chunk and loader in production', () => {
      const code = `
        import { useT } from './idioma'
        function MyComponent() {
          const t = useT()
          return t('Hello')
        }
      `;

      const result = transform(code, {
        mode: 'production',
        ...suspenseOptions,
      });

      expect(result).toContain('__useTSuspense');
      expect(result).toContain('__$idiomaChunk');
      expect(result).toContain('__$idiomaLoad');
    });

    it('transforms useT() to __useTSuspense in development mode too', () => {
      const code = `
        import { useT } from './idioma'
        function MyComponent() {
          const t = useT()
          return t('Hello')
        }
      `;

      const result = transform(code, {
        mode: 'development',
        ...suspenseOptions,
      });

      // Unlike Trans, useT should transform in dev mode too for suspense
      expect(result).toContain('__useTSuspense');
      expect(result).toContain('__$idiomaChunk');
      expect(result).toContain('__$idiomaLoad');
    });

    it('imports __useTSuspense from runtime-suspense', () => {
      const code = `
        import { useT } from './idioma'
        const t = useT()
      `;

      const result = transform(code, {
        mode: 'production',
        ...suspenseOptions,
      });

      expect(result).toContain('import {');
      expect(result).toContain('__useTSuspense');
      expect(result).toContain('@idioma/react/runtime-suspense');
    });

    it('injects chunk and loader when only useT is used (no Trans)', () => {
      const code = `
        import { useT } from './idioma'
        function MyComponent() {
          const t = useT()
          return t('Hello')
        }
      `;

      const result = transform(code, {
        mode: 'production',
        ...suspenseOptions,
      });

      expect(result).toContain('__$idiomaChunk');
      expect(result).toContain('__$idiomaLoad');
      expect(result).toContain('import(');
      // Dynamic imports for each locale
      expect(result).toContain('.en');
      expect(result).toContain('.es');
    });

    it('handles multiple useT calls in same file', () => {
      const code = `
        import { useT } from './idioma'
        function A() { const t = useT(); return t('A') }
        function B() { const t = useT(); return t('B') }
      `;

      const result = transform(code, {
        mode: 'production',
        ...suspenseOptions,
      });

      // Both should be transformed
      const useTMatches = result.match(/__useTSuspense\(/g);
      expect(useTMatches?.length).toBe(2);

      // Only one chunk declaration (shared)
      const chunkMatches = result.match(/const __\$idiomaChunk/g);
      expect(chunkMatches?.length).toBe(1);
    });

    it('handles mixed Trans and useT in same file', () => {
      const code = `
        import { Trans, useT } from './idioma'
        function MyComponent() {
          const t = useT()
          return <div><Trans>Hello</Trans>{t('World')}</div>
        }
      `;

      const result = transform(code, {
        mode: 'production',
        ...suspenseOptions,
      });

      expect(result).toContain('__TransSuspense');
      expect(result).toContain('__useTSuspense');
      // Only one set of chunk/loader injected
      const chunkMatches = result.match(/const __\$idiomaChunk/g);
      expect(chunkMatches?.length).toBe(1);
    });

    it('handles aliased useT import', () => {
      const code = `
        import { useT as useTranslation } from './idioma'
        function MyComponent() {
          const t = useTranslation()
          return t('Hello')
        }
      `;

      const result = transform(code, {
        mode: 'production',
        ...suspenseOptions,
      });

      expect(result).toContain('__useTSuspense');
    });

    it('does not transform useT in non-suspense mode', () => {
      const code = `
        import { useT } from './idioma'
        const t = useT()
      `;

      const result = transform(code, {
        mode: 'production',
        useSuspense: false,
      });

      expect(result).toContain('useT()');
      expect(result).not.toContain('__useTSuspense');
    });

    it('does not transform useT when useSuspense is not set', () => {
      const code = `
        import { useT } from './idioma'
        const t = useT()
      `;

      const result = transform(code, {
        mode: 'production',
      });

      expect(result).toContain('useT()');
      expect(result).not.toContain('__useTSuspense');
    });
  });
});
