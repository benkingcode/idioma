import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PathsMatcher } from '../../utils/resolve-tsconfig-paths';
import { extractFromFile, extractMessages } from './extract';

describe('Extract Command', () => {
  let tempDir: string;
  let srcDir: string;
  let idiomaDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-extract-'));
    srcDir = join(tempDir, 'src');
    idiomaDir = join(srcDir, 'idioma');
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(idiomaDir, { recursive: true });
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('extracts messages from Trans components', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from './idioma'
      export function App() {
        return <Trans>Hello world</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].source).toBe('Hello world');
  });

  it('extracts messages with interpolation', async () => {
    await fs.writeFile(
      join(srcDir, 'Greeting.tsx'),
      `
      import { Trans } from './idioma'
      export function Greeting({ name }) {
        return <Trans>Hello {name}</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].source).toBe('Hello {name}');
  });

  it('extracts messages with explicit id', async () => {
    await fs.writeFile(
      join(srcDir, 'Page.tsx'),
      `
      import { Trans } from './idioma'
      export function Page() {
        return <Trans id="welcome.message">Welcome to our app</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].key).toBe('welcome.message');
    expect(result.messages[0].source).toBe('Welcome to our app');
  });

  it('extracts messages from multiple files', async () => {
    await fs.writeFile(
      join(srcDir, 'A.tsx'),
      `
      import { Trans } from './idioma'
      export const A = () => <Trans>Message A</Trans>
      `,
    );
    await fs.writeFile(
      join(srcDir, 'B.tsx'),
      `
      import { Trans } from './idioma'
      export const B = () => <Trans>Message B</Trans>
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(2);
    const sources = result.messages.map((m) => m.source);
    expect(sources).toContain('Message A');
    expect(sources).toContain('Message B');
  });

  it('writes extracted messages to PO file', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from './idioma'
      export function App() {
        return <Trans>Hello world</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    const poPath = join(localeDir, 'en.po');
    const content = await fs.readFile(poPath, 'utf-8');

    // msgid is the hash key, msgstr is the source text
    expect(content).toContain(`msgid "${result.messages[0].key}"`);
    expect(content).toContain('msgstr "Hello world"');
  });

  it('preserves existing translations', async () => {
    // Create existing PO with translation
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello world"
msgstr "Hola mundo"
`,
    );

    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from './idioma'
      export function App() {
        return <Trans>Hello world</Trans>
      }
      `,
    );

    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      locales: ['en', 'es'],
      idiomaDir,
    });

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');

    expect(esContent).toContain('msgid "Hello world"');
    expect(esContent).toContain('msgstr "Hola mundo"');
  });

  it('includes file location in comments', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from './idioma'
      export function App() {
        return <Trans>Hello world</Trans>
      }
      `,
    );

    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    const poPath = join(localeDir, 'en.po');
    const content = await fs.readFile(poPath, 'utf-8');

    expect(content).toContain('#: src/App.tsx');
  });

  it('uses hash as msgid for inline Trans, source as msgstr', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from './idioma'
      export function App() {
        return <Trans>Hello world</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    // Key should be a hash, not the source text
    expect(result.messages[0].key).not.toBe('Hello world');
    expect(result.messages[0].key).toMatch(/^[0-9A-Za-z]+$/); // base62 hash format
    expect(result.messages[0].source).toBe('Hello world');

    // PO file should have hash as msgid, source as msgstr
    const poPath = join(localeDir, 'en.po');
    const content = await fs.readFile(poPath, 'utf-8');

    // msgid should be the hash, not "Hello world"
    expect(content).not.toContain('msgid "Hello world"');
    expect(content).toContain(`msgid "${result.messages[0].key}"`);
    // msgstr should be the source text as fallback
    expect(content).toContain('msgstr "Hello world"');
  });

  it('uses explicit id as msgid when id prop provided', async () => {
    await fs.writeFile(
      join(srcDir, 'Page.tsx'),
      `
      import { Trans } from './idioma'
      export function Page() {
        return <Trans id="welcome.message">Welcome to our app</Trans>
      }
      `,
    );

    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    const poPath = join(localeDir, 'en.po');
    const content = await fs.readFile(poPath, 'utf-8');

    // msgid should be the explicit key
    expect(content).toContain('msgid "welcome.message"');
    // msgstr should be the source text as fallback
    expect(content).toContain('msgstr "Welcome to our app"');
  });

  it('leaves msgstr empty for non-default locales on new messages', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from './idioma'
      export function App() {
        return <Trans>Hello world</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      locales: ['en', 'es'],
      idiomaDir,
    });

    // Default locale should have source text as msgstr
    const enContent = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    expect(enContent).toContain(`msgid "${result.messages[0].key}"`);
    expect(enContent).toContain('msgstr "Hello world"');

    // Non-default locale should have EMPTY msgstr (ready for translation)
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain(`msgid "${result.messages[0].key}"`);
    // The msgstr should be empty, not the English source text
    expect(esContent).not.toContain('msgstr "Hello world"');
    expect(esContent).toContain('msgstr ""');
  });

  it('removes unused messages with clean option', async () => {
    // Create existing PO with old message (using a hash-like key)
    // Message has 'extracted' flag so it's eligible for removal by clean
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#, extracted
msgid "oldHashKey"
msgstr "Old message"
`,
    );

    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from './idioma'
      export function App() {
        return <Trans>New message</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      clean: true,
      idiomaDir,
    });

    const content = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');

    // New message should exist with hash as msgid
    expect(content).toContain(`msgid "${result.messages[0].key}"`);
    expect(content).toContain('msgstr "New message"');
    // Old message should be removed
    expect(content).not.toContain('msgid "oldHashKey"');
  });

  it('extracts messages from createT-derived t() calls', async () => {
    await fs.writeFile(
      join(srcDir, 'server.ts'),
      `
      import { createT } from './idioma/plain'
      const t = createT('es')
      export const msg = t('Hello from server')
      `,
    );

    // Create the idioma/plain directory structure
    const plainDir = join(idiomaDir, 'plain');
    await fs.mkdir(plainDir, { recursive: true });

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.ts'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].source).toBe('Hello from server');
  });

  it('extracts from aliased createT', async () => {
    await fs.writeFile(
      join(srcDir, 'utils.ts'),
      `
      import { createT as makeT } from './idioma/plain'
      const translate = makeT('fr')
      export const greeting = translate('Welcome')
      `,
    );

    const plainDir = join(idiomaDir, 'plain');
    await fs.mkdir(plainDir, { recursive: true });

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.ts'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].source).toBe('Welcome');
  });

  it('extracts from multiple createT-derived functions', async () => {
    await fs.writeFile(
      join(srcDir, 'handler.ts'),
      `
      import { createT } from './idioma/plain'

      export function handler(locale: string) {
        const t = createT(locale as any)
        return {
          hello: t('Hello'),
          goodbye: t('Goodbye'),
        }
      }
      `,
    );

    const plainDir = join(idiomaDir, 'plain');
    await fs.mkdir(plainDir, { recursive: true });

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.ts'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(2);
    expect(result.messages.map((m) => m.source)).toContain('Hello');
    expect(result.messages.map((m) => m.source)).toContain('Goodbye');
  });

  it('extracts comment prop as PO extracted comment', async () => {
    await fs.writeFile(
      join(srcDir, 'Button.tsx'),
      `
      import { Trans } from './idioma'
      export function Button() {
        return <Trans comment="Primary action button for form submission">Submit</Trans>
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].comment).toBe(
      'Primary action button for form submission',
    );

    // Check PO file contains the extracted comment
    const poPath = join(localeDir, 'en.po');
    const content = await fs.readFile(poPath, 'utf-8');
    expect(content).toContain('#. Primary action button for form submission');
  });

  describe('path alias support', () => {
    it('extracts from aliased imports when pathsMatcher is provided', async () => {
      // Simulate: import { Trans } from '@dancefloor-start/idioma'
      // where @dancefloor-start/* maps to ./src/*
      const mockMatcher: PathsMatcher = (specifier: string) => {
        if (specifier.startsWith('@dancefloor-start/')) {
          const rest = specifier.slice('@dancefloor-start/'.length);
          return [join(tempDir, 'src', rest)];
        }
        return [];
      };

      await fs.writeFile(
        join(srcDir, 'App.tsx'),
        `
        import { Trans } from '@dancefloor-start/idioma'
        export function App() {
          return <Trans>Hello world</Trans>
        }
        `,
      );

      const result = await extractMessages({
        cwd: tempDir,
        sourcePatterns: ['src/**/*.tsx'],
        localeDir,
        defaultLocale: 'en',
        idiomaDir,
        pathsMatcher: mockMatcher,
      });

      expect(result.messages.length).toBe(1);
      expect(result.messages[0].source).toBe('Hello world');
    });

    it('extracts nothing from aliased imports without pathsMatcher', async () => {
      await fs.writeFile(
        join(srcDir, 'App.tsx'),
        `
        import { Trans } from '@dancefloor-start/idioma'
        export function App() {
          return <Trans>Hello world</Trans>
        }
        `,
      );

      const result = await extractMessages({
        cwd: tempDir,
        sourcePatterns: ['src/**/*.tsx'],
        localeDir,
        defaultLocale: 'en',
        idiomaDir,
        // No pathsMatcher — alias won't be resolved
      });

      expect(result.messages.length).toBe(0);
    });

    it('extractFromFile detects aliased Trans import', async () => {
      const mockMatcher: PathsMatcher = (specifier: string) => {
        if (specifier.startsWith('@app/')) {
          const rest = specifier.slice('@app/'.length);
          return [join('/project/src', rest)];
        }
        return [];
      };

      const code = `
        import { Trans } from '@app/idioma'
        export function App() {
          return <Trans>Hello world</Trans>
        }
      `;

      const messages = await extractFromFile(
        code,
        '/project/src/App.tsx',
        'src/App.tsx',
        '/project/src/idioma',
        mockMatcher,
      );

      expect(messages.length).toBe(1);
      expect(messages[0].source).toBe('Hello world');
    });

    it('extractFromFile detects aliased useT import', async () => {
      const mockMatcher: PathsMatcher = (specifier: string) => {
        if (specifier.startsWith('@app/')) {
          const rest = specifier.slice('@app/'.length);
          return [join('/project/src', rest)];
        }
        return [];
      };

      const code = `
        import { useT } from '@app/idioma'
        function Component() {
          const t = useT()
          return t('Hello')
        }
      `;

      const messages = await extractFromFile(
        code,
        '/project/src/Component.tsx',
        'src/Component.tsx',
        '/project/src/idioma',
        mockMatcher,
      );

      expect(messages.length).toBe(1);
      expect(messages[0].source).toBe('Hello');
    });
  });
});
