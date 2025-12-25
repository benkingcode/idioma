import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheck } from '../../src/cli/commands/check';
import { runCompile } from '../../src/cli/commands/compile';
import { extractMessages } from '../../src/cli/commands/extract';
import { runStats } from '../../src/cli/commands/stats';

describe('End-to-End Workflow', () => {
  let tempDir: string;
  let srcDir: string;
  let idiomaDir: string;
  let localeDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-e2e-'));
    srcDir = join(tempDir, 'src');
    // New folder structure: idiomaDir contains locales/ and .generated/
    idiomaDir = join(tempDir, 'idioma');
    localeDir = join(idiomaDir, 'locales');
    outputDir = idiomaDir;
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('complete workflow: extract → compile → check', async () => {
    // Step 1: Create source files with Trans components
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from '@idioma/react'

      export function App() {
        return (
          <div>
            <Trans>Hello world</Trans>
            <Trans>Welcome to our app</Trans>
          </div>
        )
      }
      `,
    );

    await fs.mkdir(join(srcDir, 'components'), { recursive: true });
    await fs.writeFile(
      join(srcDir, 'components/Greeting.tsx'),
      `
      import { Trans } from '@idioma/react'

      export function Greeting({ name }) {
        return <Trans>Hello {name}!</Trans>
      }
      `,
    );

    // Step 2: Extract messages
    const extractResult = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      locales: ['en', 'es'],
    });

    expect(extractResult.messages.length).toBe(3);
    expect(extractResult.files).toBe(2);

    // Verify PO files were created
    const enPo = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    expect(enPo).toContain('msgid "Hello world"');
    expect(enPo).toContain('msgid "Welcome to our app"');
    expect(enPo).toContain('msgid "Hello {name}!"');

    const esPo = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esPo).toContain('msgid "Hello world"');

    // Step 3: Add Spanish translations
    const translatedEsPo = esPo
      .replace(
        'msgid "Hello world"\nmsgstr ""',
        'msgid "Hello world"\nmsgstr "Hola mundo"',
      )
      .replace(
        'msgid "Welcome to our app"\nmsgstr ""',
        'msgid "Welcome to our app"\nmsgstr "Bienvenido a nuestra app"',
      )
      .replace(
        'msgid "Hello {name}!"\nmsgstr ""',
        'msgid "Hello {name}!"\nmsgstr "¡Hola {name}!"',
      );

    await fs.writeFile(join(localeDir, 'es.po'), translatedEsPo);

    // Step 4: Compile translations
    const compileResult = await runCompile({
      localeDir,
      outputDir,
      defaultLocale: 'en',
    });

    expect(compileResult.locales).toContain('en');
    expect(compileResult.locales).toContain('es');

    // Verify compiled output - internal files go to .generated/
    const translationsJs = await fs.readFile(
      join(outputDir, '.generated', 'translations.js'),
      'utf-8',
    );
    expect(translationsJs).toContain('Hello world');
    expect(translationsJs).toContain('Hola mundo');

    const typesTs = await fs.readFile(
      join(outputDir, '.generated', 'types.ts'),
      'utf-8',
    );
    expect(typesTs).toContain('Locale');
    expect(typesTs).toContain('"en"');
    expect(typesTs).toContain('"es"');

    // User-facing files stay at the root
    const indexTs = await fs.readFile(join(outputDir, 'index.ts'), 'utf-8');
    expect(indexTs).toContain('export const Trans = createTrans');
    expect(indexTs).toContain('export const useT = createUseT');
    // index.ts should import from .generated/
    expect(indexTs).toContain('./.generated/translations.js');

    // Step 5: Check translations
    const checkResult = await runCheck({ localeDir });

    expect(checkResult.complete).toBe(true);
    expect(checkResult.missing).toHaveLength(0);
  });

  it('extracts messages with explicit IDs', async () => {
    await fs.writeFile(
      join(srcDir, 'Page.tsx'),
      `
      import { Trans } from '@idioma/react'

      export function Page() {
        return (
          <Trans id="page.title">Welcome</Trans>
        )
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
    });

    // The explicit ID is used as the key
    expect(result.messages[0].key).toBe('page.title');

    const enPo = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    // When using explicit ID as key, the source becomes msgid
    expect(enPo).toContain('msgid "Welcome"');
  });

  it('handles component interpolation', async () => {
    await fs.writeFile(
      join(srcDir, 'Links.tsx'),
      `
      import { Trans } from '@idioma/react'

      export function Links() {
        return (
          <Trans>
            Click <Link>here</Link> to continue
          </Trans>
        )
      }
      `,
    );

    const result = await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
    });

    expect(result.messages[0].source).toBe('Click <0>here</0> to continue');
  });

  it('preserves existing translations on re-extract', async () => {
    // Initial extract
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from '@idioma/react'
      export const App = () => <Trans>Hello</Trans>
      `,
    );

    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      locales: ['en', 'es'],
    });

    // Add translation - replace the specific empty msgstr for Hello
    const esPo = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    const translated = esPo.replace(
      'msgid "Hello"\nmsgstr ""',
      'msgid "Hello"\nmsgstr "Hola"',
    );
    await fs.writeFile(join(localeDir, 'es.po'), translated);

    // Add new message and re-extract
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from '@idioma/react'
      export const App = () => (
        <>
          <Trans>Hello</Trans>
          <Trans>World</Trans>
        </>
      )
      `,
    );

    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      locales: ['en', 'es'],
    });

    // Verify existing translation preserved
    const updatedEs = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(updatedEs).toContain('msgstr "Hola"');
    expect(updatedEs).toContain('msgid "World"');
  });

  it('reports stats correctly', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"

msgid "World"
msgstr "World"
`,
    );

    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"

msgid "World"
msgstr ""
`,
    );

    const stats = await runStats({ localeDir });

    expect(stats.totalMessages).toBe(2);
    expect(stats.locales).toHaveLength(2);

    const enStats = stats.locales.find((l) => l.locale === 'en');
    expect(enStats?.percentage).toBe(100);

    const esStats = stats.locales.find((l) => l.locale === 'es');
    expect(esStats?.percentage).toBe(50);
    expect(esStats?.missing).toBe(1);
  });

  it('clean option removes unused messages', async () => {
    // Create initial PO with messages
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

    // Create source with different message
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `
      import { Trans } from '@idioma/react'
      export const App = () => <Trans>New message</Trans>
      `,
    );

    // Extract with clean option
    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      clean: true,
    });

    const enPo = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    expect(enPo).toContain('msgid "New message"');
    expect(enPo).not.toContain('msgid "Old message"');
  });
});
