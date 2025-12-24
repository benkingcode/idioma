import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractMessages } from './extract';

describe('Extract Command', () => {
  let tempDir: string;
  let srcDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-extract-'));
    srcDir = join(tempDir, 'src');
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('extracts messages from Trans components', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from '@idioma/react'
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
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].source).toBe('Hello world');
  });

  it('extracts messages with interpolation', async () => {
    await fs.writeFile(
      join(srcDir, 'Greeting.tsx'),
      `
      import { Trans } from '@idioma/react'
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
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].source).toBe('Hello {name}');
  });

  it('extracts messages with explicit id', async () => {
    await fs.writeFile(
      join(srcDir, 'Page.tsx'),
      `
      import { Trans } from '@idioma/react'
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
    });

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].key).toBe('welcome.message');
    expect(result.messages[0].source).toBe('Welcome to our app');
  });

  it('extracts messages from multiple files', async () => {
    await fs.writeFile(
      join(srcDir, 'A.tsx'),
      `
      import { Trans } from '@idioma/react'
      export const A = () => <Trans>Message A</Trans>
      `,
    );
    await fs.writeFile(
      join(srcDir, 'B.tsx'),
      `
      import { Trans } from '@idioma/react'
      export const B = () => <Trans>Message B</Trans>
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
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
      import { Trans } from '@idioma/react'
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
    });

    const poPath = join(localeDir, 'en.po');
    const content = await fs.readFile(poPath, 'utf-8');

    expect(content).toContain('msgid "Hello world"');
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
      import { Trans } from '@idioma/react'
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
    });

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');

    expect(esContent).toContain('msgid "Hello world"');
    expect(esContent).toContain('msgstr "Hola mundo"');
  });

  it('includes file location in comments', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from '@idioma/react'
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
    });

    const poPath = join(localeDir, 'en.po');
    const content = await fs.readFile(poPath, 'utf-8');

    expect(content).toContain('#: src/App.tsx');
  });

  it('removes unused messages with clean option', async () => {
    // Create existing PO with old message
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Old message"
msgstr "Old message"
`,
    );

    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from '@idioma/react'
      export function App() {
        return <Trans>New message</Trans>
      }
      `,
    );

    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      clean: true,
    });

    const content = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');

    expect(content).toContain('msgid "New message"');
    expect(content).not.toContain('msgid "Old message"');
  });
});
