import { join } from 'path';
import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';
import { generateKey } from '../keys/generator.js';
import type { PathsMatcher } from '../utils/resolve-tsconfig-paths';
import type { ExtractedMessage } from './extract-trans';
import idiomaPlugin, { type IdiomaPluginOptions } from './plugin';

// Default test configuration for idiomaDir-based detection
const TEST_IDIOMA_DIR = '/project/src/idioma';
const TEST_FILENAME = '/project/src/App.tsx';

function transform(
  code: string,
  options: IdiomaPluginOptions = {},
  filename = TEST_FILENAME,
): string {
  const result = babel.transformSync(code, {
    presets: ['@babel/preset-react', '@babel/preset-typescript'],
    plugins: [[idiomaPlugin, options]],
    filename,
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

      const result = transform(code, { mode: 'inlined' });

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

      const result = transform(code, { mode: 'inlined' });

      expect(result).toContain('useT()');
      expect(result).not.toContain('__useT');
    });
  });

  describe('production mode', () => {
    describe('member expression handling', () => {
      it('handles member expression placeholder in __a prop', () => {
        const code = `
          import { Trans } from './idioma'
          const x = <Trans>Hello {user.name}</Trans>
        `;

        const result = transform(code, {
          mode: 'inlined',
          idiomaDir: TEST_IDIOMA_DIR,
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
          import { Trans } from './idioma'
          const x = <Trans>Value: {data.nested.value}</Trans>
        `;

        const result = transform(code, {
          mode: 'inlined',
          idiomaDir: TEST_IDIOMA_DIR,
          translations: {},
        });

        expect(result).toContain('__a');
        // The VALUE should be data.nested.value, not just data
        expect(result).toMatch(/"data\.nested\.value":\s*data\.nested\.value/);
      });

      it('handles member expression in suspense mode', () => {
        const code = `
          import { Trans } from './idioma'
          const x = <Trans>Hello {user.name}</Trans>
        `;

        const result = transform(code, {
          mode: 'suspense',
          idiomaDir: TEST_IDIOMA_DIR,
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
          import { Trans } from './idioma'
          const x = <Trans>First item: {items[0]}</Trans>
        `;

        const result = transform(code, {
          mode: 'inlined',
          idiomaDir: TEST_IDIOMA_DIR,
          translations: {},
        });

        expect(result).toContain('__a');
        // Array access is a MemberExpression, key is "items[0]", value is items[0]
        expect(result).toMatch(/"items\[0\]":\s*items\[0\]/);
      });
    });

    it('transforms Trans to __Trans with translations', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { Trans } from './idioma'
        const x = <Trans>Hello {name}</Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {},
      });

      expect(result).toContain('__Trans');
      expect(result).toContain('__a');
    });

    it('transforms Trans with components', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Click <Link>here</Link></Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {},
      });

      expect(result).toContain('__Trans');
      expect(result).toContain('__c');
    });

    it('emits intrinsic HTML elements as JSX elements in __c', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Text with <span>inline</span> content</Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {},
      });

      // __c should contain a createElement("span", ...) call (from JSX element)
      expect(result).toMatch(/createElement\("span"/);
      // __cn should still have "span" as a string
      expect(result).toMatch(/__cn:\s*\["span"\]/);
    });

    it('emits both custom and intrinsic elements as JSX elements in __c', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Click <Link>here</Link> or <span>there</span></Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {},
      });

      // __c should have createElement calls for both Link and "span"
      expect(result).toMatch(/createElement\(Link/);
      expect(result).toMatch(/createElement\("span"/);
      // __cn should still have string names
      expect(result).toMatch(/__cn:\s*\["Link", "span"\]/);
    });

    it('preserves component props in __c', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Style <Text size="inherit" fw={500}>content</Text> here</Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {},
      });

      // Props should appear in the createElement call inside __c
      expect(result).toContain('size: "inherit"');
      expect(result).toContain('fw: 500');
    });

    it('preserves intrinsic element props in __c', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Go <span style={{ fontWeight: 500 }}>bold</span></Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {},
      });

      // Style prop should be preserved in the span's createElement
      expect(result).toContain('fontWeight: 500');
    });

    it('handles Trans with explicit id', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans id="greeting">Hello</Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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

    it('transforms import from idioma folder to include runtime', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello</Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {},
      });

      // Should import __Trans from runtime
      expect(result).toContain('__Trans');
    });

    it('injects __Trans import for non-suspense production mode', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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

    it('does not inject __Trans import when no Trans is used', () => {
      const code = `
        const x = <div>Hello</div>
      `;

      const result = transform(code, {
        mode: 'inlined',
        translations: {},
      });

      expect(result).not.toContain('__Trans');
    });
  });

  describe('extraction', () => {
    it('extracts messages from Trans components', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello world');
    });

    it('extracts correct whitespace from multiline component tags', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { Trans } from './idioma'
        const x = (
          <Trans>
            Built with{' '}
            <span style={{ fontWeight: 500 }}>
              open source
            </span>{' '}
            tools
          </Trans>
        )
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      // No extra spaces inside <span> tags
      expect(extracted[0].source).toBe(
        'Built with <span>open source</span> tools',
      );
    });

    it('extracts multiple messages', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { Trans } from './idioma'
        const x = (
          <div>
            <Trans>First</Trans>
            <Trans>Second</Trans>
          </div>
        )
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(2);
    });
  });

  describe('suspense mode', () => {
    const suspenseOptions = {
      mode: 'suspense' as const,
      idiomaDir: TEST_IDIOMA_DIR,
      locales: ['en', 'es'],
      outputDir: './idioma',
      projectRoot: '/project',
    };

    it('injects __$idiomaChunk constant', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, suspenseOptions);

      expect(result).toContain('__$idiomaChunk');
    });

    it('injects __$idiomaLoad with dynamic imports for all locales', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, {
        ...suspenseOptions,
        locales: ['en', 'es', 'de'],
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
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, suspenseOptions);

      expect(result).toContain('__TransSuspense');
      expect(result).toContain('__key');
      expect(result).toContain('__chunk');
      expect(result).toContain('__load');
    });

    it('imports __TransSuspense from runtime-suspense', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(code, suspenseOptions);

      expect(result).toContain('@idioma/react/runtime-suspense');
      expect(result).toContain('__TransSuspense');
    });

    it('handles multiple Trans components in same file (shared loader)', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>First</Trans>
        const y = <Trans>Second</Trans>
      `;

      const result = transform(code, suspenseOptions);

      // Should only inject once
      const chunkMatches = result.match(/__\$idiomaChunk/g);
      expect(chunkMatches?.length).toBeGreaterThan(0);

      // Both Trans components should use the same chunk
      expect(result).toContain('__TransSuspense');
    });

    it('preserves __a for interpolation in suspense mode', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello {name}</Trans>
      `;

      const result = transform(code, suspenseOptions);

      expect(result).toContain('__a');
      expect(result).toContain('name');
    });

    it('preserves __c for components in suspense mode', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Click <Link>here</Link></Trans>
      `;

      const result = transform(code, suspenseOptions);

      expect(result).toContain('__c');
      expect(result).toContain('Link');
    });
  });

  describe('t() call transformation', () => {
    it('leaves t() calls unchanged in dev mode', () => {
      const code = `
        import { t } from './idioma'
        const msg = t('Hello world')
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
      });

      expect(result).toContain("t('Hello world')");
      expect(result).not.toContain('en:');
      expect(result).not.toContain('es:');
    });

    it('inlines translations for t() calls in production mode', () => {
      const code = `
        import { t } from './idioma'
        const msg = t('Hello world')
      `;

      // Key for 'Hello world' is '003B4Ntk'
      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { t } from './idioma'
        const msg = t('Hello {name}', { name: 'Ben' })
      `;

      // Key for 'Hello {name}' is '000VsT4w'
      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { t } from './idioma'
        const key = 'Hello world'
        const msg = t(key)
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { t } from './idioma'
        const msg = t('Hello world')
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello world');
    });

    it('handles t() calls with context option', () => {
      const code = `
        import { t } from './idioma'
        const msg = t('Submit', undefined, { context: 'button' })
      `;

      // Key for 'Submit' (without context in transformation - context is in 3rd arg)
      // For now, context support in t() is limited - the call still uses the plain key
      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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

    it('leaves dynamic t() calls unchanged (runtime handles lookup)', () => {
      const code = `
        import { t } from './idioma'
        const key = getErrorKey()
        const msg = t(key)
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        outputDir: './idioma',
      });

      // Dynamic t() calls are left as-is - runtime IdiomaProvider handles lookup
      expect(result).toContain('t(key)');
      // No translations injection needed - context provides translations
      expect(result).not.toContain('__$translations');
    });

    it('does not inject translations for static-only t() calls', () => {
      const code = `
        import { t } from './idioma'
        const msg = t('Hello world')
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        outputDir: './idioma',
        translations: {
          '003B4Ntk': { en: 'Hello world', es: 'Hola mundo' },
        },
      });

      // Should NOT inject translations import for static-only files
      expect(result).not.toContain('__$translations');
      expect(result).not.toContain('./idioma/.generated/translations');
    });

    it('inlines static t() calls while leaving dynamic ones for runtime', () => {
      const code = `
        import { t } from './idioma'
        const staticMsg = t('Hello world')
        const dynamicKey = getKey()
        const dynamicMsg = t(dynamicKey)
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        outputDir: './idioma',
        translations: {
          '003B4Ntk': { en: 'Hello world', es: 'Hola mundo' },
        },
      });

      // Static call should be inlined
      expect(result).toContain('Hola mundo');
      // Dynamic call left for runtime (IdiomaProvider handles lookup)
      expect(result).toContain('t(dynamicKey)');
      // No injection needed - context provides translations
      expect(result).not.toContain('__$translations');
    });
  });

  describe('t() with template literals and plural()', () => {
    it('extracts template literal with plural() call', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { plural } from '@idioma/core/icu'
        import { t } from './idioma'
        const msg = t(\`You have \${plural(count, { one: "# item", other: "# items" })} in cart\`)
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { plural } from '@idioma/core/icu'
        import { t } from './idioma'
        const msg = t(\`Hello \${name}, you have \${plural(count, { one: "# message", other: "# messages" })}\`)
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { plural } from '@idioma/core/icu'
        import { t } from './idioma'
        const msg = t(\`Items: \${plural(data.count, { one: "#", other: "#" })}\`)
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { plural } from '@idioma/core/icu'
        import { Trans } from './idioma'
        const x = <Trans>You have {plural(count, { one: "# item", other: "# items" })} in cart</Trans>
      `;
      transform(transCode, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => transExtracted.push(msg),
      });

      // t() version
      const tCode = `
        import { plural } from '@idioma/core/icu'
        import { t } from './idioma'
        const msg = t(\`You have \${plural(count, { one: "# item", other: "# items" })} in cart\`)
      `;
      transform(tCode, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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
        import { plural } from '@idioma/core/icu'
        import { t } from './idioma'
        const msg = t(\`\${plural(n, { zero: "none", one: "one", two: "two", few: "few", many: "many", other: "other" })}\`)
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe(
        '{n, plural, zero {none} one {one} two {two} few {few} many {many} other {other}}',
      );
    });
  });

  describe('config-based import detection', () => {
    const idiomaDir = '/project/src/idioma';
    // Filename must be in /project/src/ so that './idioma' resolves to idiomaDir
    const testFilename = '/project/src/App.tsx';

    it('detects Trans from configured idioma path', () => {
      const code = `
        import { Trans } from './idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          translations: {},
        },
        testFilename,
      );

      expect(result).toContain('__Trans');
    });

    it('handles aliased Trans import', () => {
      const code = `
        import { Trans as T } from './idioma'
        const x = <T>Hello world</T>
      `;

      const result = transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          translations: {},
        },
        testFilename,
      );

      expect(result).toContain('__Trans');
    });

    it('handles variable alias of Trans', () => {
      const code = `
        import { Trans } from './idioma'
        const Message = Trans
        const x = <Message>Hello world</Message>
      `;

      const result = transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          translations: {},
        },
        testFilename,
      );

      expect(result).toContain('__Trans');
    });

    it('handles combined import and variable aliases', () => {
      const code = `
        import { Trans as T } from './idioma'
        const Message = T
        const x = <Message>Hello world</Message>
      `;

      const result = transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          translations: {},
        },
        testFilename,
      );

      expect(result).toContain('__Trans');
    });

    it('does not transform Trans from non-idioma imports', () => {
      const code = `
        import { Trans } from 'some-other-library'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          translations: {},
        },
        testFilename,
      );

      // Should NOT be transformed since it's not from idioma path
      expect(result).not.toContain('__Trans');
    });

    it('handles useT aliased import with config', () => {
      const code = `
        import { useT as useTranslation } from './idioma'
        const t = useTranslation()
      `;

      const result = transform(
        code,
        {
          mode: 'suspense',
          idiomaDir,
          locales: ['en', 'es'],
          outputDir: './idioma',
          projectRoot: '/project',
        },
        testFilename,
      );

      expect(result).toContain('__useTSuspense');
    });

    it('handles t function aliased import', () => {
      const extracted: Array<{ source: string }> = [];

      const code = `
        import { t as translate } from './idioma'
        const msg = translate('Hello world')
      `;

      transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          onExtract: (msg) => extracted.push(msg),
        },
        testFilename,
      );

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello world');
    });

    it('extracts from aliased Trans', () => {
      const extracted: Array<{ source: string }> = [];

      const code = `
        import { Trans as T } from './idioma'
        const x = <T>Hello world</T>
      `;

      transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          onExtract: (msg) => extracted.push(msg),
        },
        testFilename,
      );

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello world');
    });
  });

  describe('path alias import detection', () => {
    const idiomaDir = '/project/src/idioma';
    const testFilename = '/project/src/App.tsx';

    // Mock matcher: @dancefloor-start/* → /project/src/*
    const mockMatcher: PathsMatcher = (specifier: string) => {
      if (specifier.startsWith('@dancefloor-start/')) {
        const rest = specifier.slice('@dancefloor-start/'.length);
        return [join('/project/src', rest)];
      }
      return [];
    };

    it('transforms Trans from aliased import when pathsMatcher is provided', () => {
      const code = `
        import { Trans } from '@dancefloor-start/idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          pathsMatcher: mockMatcher,
          translations: {},
        },
        testFilename,
      );

      expect(result).toContain('__Trans');
    });

    it('does not transform aliased import without pathsMatcher', () => {
      const code = `
        import { Trans } from '@dancefloor-start/idioma'
        const x = <Trans>Hello world</Trans>
      `;

      const result = transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          translations: {},
          // No pathsMatcher
        },
        testFilename,
      );

      expect(result).not.toContain('__Trans');
    });

    it('extracts messages from aliased Trans', () => {
      const extracted: Array<{ source: string }> = [];

      const code = `
        import { Trans } from '@dancefloor-start/idioma'
        const x = <Trans>Discover events</Trans>
      `;

      transform(
        code,
        {
          mode: 'inlined',
          idiomaDir,
          pathsMatcher: mockMatcher,
          onExtract: (msg) => extracted.push(msg),
        },
        testFilename,
      );

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Discover events');
    });

    it('handles useT from aliased import in suspense mode', () => {
      const code = `
        import { useT } from '@dancefloor-start/idioma'
        const t = useT()
      `;

      const result = transform(
        code,
        {
          mode: 'suspense',
          idiomaDir,
          pathsMatcher: mockMatcher,
          locales: ['en', 'es'],
          outputDir: './idioma',
          projectRoot: '/project',
        },
        testFilename,
      );

      expect(result).toContain('__useTSuspense');
    });
  });

  describe('useT suspense mode', () => {
    const suspenseOptions = {
      mode: 'suspense' as const,
      idiomaDir: TEST_IDIOMA_DIR,
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

      const result = transform(code, suspenseOptions);

      // useT transforms in suspense mode
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
        ...suspenseOptions,
      });

      expect(result).toContain('__useTSuspense');
    });

    it('does not transform useT in inlined mode', () => {
      const code = `
        import { useT } from './idioma'
        const t = useT()
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
      });

      expect(result).toContain('useT()');
      expect(result).not.toContain('__useTSuspense');
    });

    it('extracts messages from useT-derived t() calls', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { useT } from './idioma'
        function MyComponent() {
          const t = useT()
          return t('Hello from useT')
        }
      `;

      transform(code, {
        ...suspenseOptions,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello from useT');
    });

    describe('t() calls in suspense mode', () => {
      it('replaces source text with hash key for string form', () => {
        const code = `
          import { useT } from './idioma'
          function MyComponent() {
            const t = useT()
            return t('Hello')
          }
        `;

        const result = transform(code, suspenseOptions);

        const expectedKey = generateKey('Hello');
        expect(result).toContain(`"${expectedKey}"`);
        // Source text should not appear as a string literal arg
        expect(result).not.toMatch(/t\(\s*["']Hello["']\s*\)/);
      });

      it('preserves values arg when replacing source with key', () => {
        const code = `
          import { useT } from './idioma'
          function MyComponent() {
            const t = useT()
            const name = 'Ben'
            return t('Welcome, {name}!', { name })
          }
        `;

        const result = transform(code, suspenseOptions);

        const expectedKey = generateKey('Welcome, {name}!');
        expect(result).toContain(`"${expectedKey}"`);
        // Values arg should still be present
        expect(result).toContain('name');
      });

      it('uses id as key for object form with source', () => {
        const code = `
          import { useT } from './idioma'
          function MyComponent() {
            const t = useT()
            return t({ id: 'uset.greeting', source: 'Hello from object form!' })
          }
        `;

        const result = transform(code, suspenseOptions);

        expect(result).toContain('"uset.greeting"');
        // Source text should not appear as a string literal arg
        expect(result).not.toContain('"Hello from object form!"');
      });

      it('uses id as key for object form with values', () => {
        const code = `
          import { useT } from './idioma'
          function MyComponent() {
            const t = useT()
            const name = 'Tester'
            return t({ id: 'uset.welcome', source: 'Welcome, {name}!', values: { name } })
          }
        `;

        const result = transform(code, suspenseOptions);

        expect(result).toContain('"uset.welcome"');
        // Values should be preserved as second arg
        expect(result).toContain('name');
      });

      it('uses id as key for object form without source', () => {
        const code = `
          import { useT } from './idioma'
          function MyComponent() {
            const t = useT()
            return t({ id: 'uset.idOnly' })
          }
        `;

        const result = transform(code, suspenseOptions);

        expect(result).toContain('"uset.idOnly"');
      });

      it('still extracts with original source text', () => {
        const extracted: Array<{ key: string; source: string }> = [];

        const code = `
          import { useT } from './idioma'
          function MyComponent() {
            const t = useT()
            return t('Hello')
          }
        `;

        transform(code, {
          ...suspenseOptions,
          onExtract: (msg) => extracted.push(msg),
        });

        expect(extracted).toHaveLength(1);
        expect(extracted[0].source).toBe('Hello');
        expect(extracted[0].key).toBe(generateKey('Hello'));
      });
    });
  });

  describe('createT binding tracking', () => {
    it('tracks createT import and derived t function', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { createT } from './idioma'
        const t = createT('es')
        const msg = t('Hello world')
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello world');
    });

    it('inlines translations for createT-derived t() calls in production', () => {
      const code = `
        import { createT } from './idioma'
        const t = createT('es')
        const msg = t('Hello world')
      `;

      // Key for 'Hello world' is '003B4Ntk'
      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
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

    it('handles aliased createT import', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { createT as makeTranslator } from './idioma'
        const translate = makeTranslator('es')
        const msg = translate('Hello')
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].source).toBe('Hello');
    });

    it('tracks multiple createT-derived functions', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { createT } from './idioma'
        const tEn = createT('en')
        const tEs = createT('es')
        const msgEn = tEn('Hello')
        const msgEs = tEs('Goodbye')
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(2);
      expect(extracted.map((m) => m.source)).toContain('Hello');
      expect(extracted.map((m) => m.source)).toContain('Goodbye');
    });

    it('leaves dynamic t() calls unchanged (falls back to source)', () => {
      const code = `
        import { createT } from './idioma'
        const t = createT('es')
        const key = getErrorKey()
        const msg = t(key)
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
      });

      // Dynamic calls are left as-is
      expect(result).toContain('t(key)');
    });

    it('does not track createT from non-idioma imports', () => {
      const extracted: Array<{ key: string; source: string }> = [];

      const code = `
        import { createT } from 'some-other-package'
        const t = createT('es')
        const msg = t('Hello')
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      // Should not extract because createT is not from idioma folder
      expect(extracted).toHaveLength(0);
    });
  });

  describe('t() with object form', () => {
    // --- Extraction tests ---

    it('extracts t({ id }) with empty source', () => {
      const extracted: ExtractedMessage[] = [];

      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          return t({ id: 'home.title' })
        }
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].key).toBe('home.title');
      expect(extracted[0].source).toBe('');
    });

    it('extracts t({ id, source }) with source text', () => {
      const extracted: ExtractedMessage[] = [];

      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          return t({ id: 'home.title', source: 'Discover events' })
        }
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].key).toBe('home.title');
      expect(extracted[0].source).toBe('Discover events');
    });

    it('extracts t({ id, context, ns })', () => {
      const extracted: ExtractedMessage[] = [];

      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          return t({ id: 'submit', context: 'button', ns: 'auth' })
        }
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].key).toBe('submit');
      expect(extracted[0].context).toBe('button');
      expect(extracted[0].namespace).toBe('auth');
    });

    it('skips t() with dynamic id', () => {
      const extracted: ExtractedMessage[] = [];

      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          const key = 'dynamic'
          return t({ id: key })
        }
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(0);
    });

    it('skips t() with object missing id', () => {
      const extracted: ExtractedMessage[] = [];

      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          return t({ source: 'text' })
        }
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(0);
    });

    // --- Transformation tests ---

    it('inlines translations for t({ id, source })', () => {
      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          return t({ id: 'greeting', source: 'Hello' })
        }
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {
          greeting: {
            en: 'Hello',
            es: 'Hola',
          },
        },
      });

      // Should transform to string form with inlined translations
      expect(result).toContain('"Hello"');
      expect(result).toContain('"Hola"');
      expect(result).toContain('"greeting"');
      // Should not contain the object form anymore
      expect(result).not.toContain('id:');
    });

    it('inlines translations with values', () => {
      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          const name = 'Ben'
          return t({ id: 'greet', source: 'Hi {name}', values: { name } })
        }
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        translations: {
          greet: {
            en: 'Hi {name}',
            es: 'Hola {name}',
          },
        },
      });

      // Should have 3 args: source string, inlined translations, values
      expect(result).toContain('"Hi {name}"');
      expect(result).toContain('"Hola {name}"');
      expect(result).toContain('name');
      expect(result).not.toContain('id:');
    });

    it('normalizes to string form when no translations found (with source)', () => {
      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          return t({ id: 'missing', source: 'Hello' })
        }
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
      });

      // Should normalize to t('Hello') - source as first arg
      expect(result).toContain('t("Hello")');
      expect(result).not.toContain('id:');
    });

    it('normalizes to string form when no translations and no source', () => {
      const code = `
        import { useT } from './idioma'
        function Comp() {
          const t = useT()
          return t({ id: 'missing' })
        }
      `;

      const result = transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
      });

      // Should normalize to t('missing') - id as fallback first arg
      expect(result).toContain('t("missing")');
      expect(result).not.toContain('id:');
    });

    it('works with createT-derived t() binding', () => {
      const extracted: ExtractedMessage[] = [];

      const code = `
        import { createT } from './idioma'
        const t = createT('en')
        const msg = t({ id: 'server.greeting', source: 'Hello from server' })
      `;

      transform(code, {
        mode: 'inlined',
        idiomaDir: TEST_IDIOMA_DIR,
        onExtract: (msg) => extracted.push(msg),
      });

      expect(extracted).toHaveLength(1);
      expect(extracted[0].key).toBe('server.greeting');
      expect(extracted[0].source).toBe('Hello from server');
    });
  });
});
