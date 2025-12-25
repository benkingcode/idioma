import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parsePoString, writePoFile } from '../po/parser';
import { compileTranslations, type CompileOptions } from './compile';

describe('compileTranslations', () => {
  let tempDir: string;
  let outputDir: string;
  let poDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-compile-'));
    outputDir = join(tempDir, 'idioma');
    poDir = join(tempDir, 'locales');
    await fs.mkdir(poDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createPoFile(locale: string, content: string) {
    const catalog = parsePoString(content, locale);
    await writePoFile(join(poDir, `${locale}.po`), catalog);
  }

  it('creates output directory', async () => {
    await createPoFile(
      'en',
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'en',
    });

    const stats = await fs.stat(outputDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('generates translations.js with message data in .generated/', async () => {
    await createPoFile(
      'en',
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`,
    );

    await createPoFile(
      'es',
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'en',
    });

    const translationsPath = join(outputDir, '.generated', 'translations.js');
    const content = await fs.readFile(translationsPath, 'utf-8');

    expect(content).toContain('Hello');
    expect(content).toContain('Hola');
    expect(content).toContain('export');
  });

  it('generates types.ts with TypeScript definitions in .generated/', async () => {
    await createPoFile(
      'en',
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello {name}"
msgstr "Hello {name}"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'en',
    });

    const typesPath = join(outputDir, '.generated', 'types.ts');
    const content = await fs.readFile(typesPath, 'utf-8');

    expect(content).toContain('interface');
    expect(content).toContain('name');
  });

  it('generates index.ts with exports at outputDir root', async () => {
    await createPoFile(
      'en',
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'en',
    });

    const indexPath = join(outputDir, 'index.ts');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('export');
    expect(content).toContain('./.generated/translations.js');
  });

  it('compiles ICU plural messages to functions', async () => {
    await createPoFile(
      'en',
      `
msgid ""
msgstr ""
"Language: en\\n"

#, icu-format
msgid "{count, plural, one {# item} other {# items}}"
msgstr "{count, plural, one {# item} other {# items}}"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'en',
    });

    const translationsPath = join(outputDir, '.generated', 'translations.js');
    const content = await fs.readFile(translationsPath, 'utf-8');

    // Compiled plural should be an arrow function
    expect(content).toContain('(args) =>');
  });

  describe('useSuspense mode', () => {
    it('generates chunks directory when useSuspense is true', async () => {
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

#: src/HomePage.tsx:10
msgid "Hello"
msgstr "Hello"
`,
      );

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
        useSuspense: true,
        locales: ['en'],
        projectRoot: tempDir,
      });

      const chunksDir = join(outputDir, '.generated', 'chunks');
      const stats = await fs.stat(chunksDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('generates chunk files per locale in .generated/', async () => {
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

#: src/HomePage.tsx:10
msgid "Hello"
msgstr "Hello"
`,
      );

      await createPoFile(
        'es',
        `
msgid ""
msgstr ""
"Language: es\\n"

#: src/HomePage.tsx:10
msgid "Hello"
msgstr "Hola"
`,
      );

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
        useSuspense: true,
        locales: ['en', 'es'],
        projectRoot: tempDir,
      });

      const files = await fs.readdir(join(outputDir, '.generated', 'chunks'));
      expect(files.some((f) => f.endsWith('.en.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('.es.ts'))).toBe(true);
    });

    it('generates manifest.json in .generated/', async () => {
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

#: src/HomePage.tsx:10
msgid "Hello"
msgstr "Hello"
`,
      );

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
        useSuspense: true,
        locales: ['en'],
        projectRoot: tempDir,
      });

      const manifest = JSON.parse(
        await fs.readFile(
          join(outputDir, '.generated', 'manifest.json'),
          'utf-8',
        ),
      );
      expect(manifest.chunks).toBeDefined();
    });

    it('generates index.ts with suspense runtime imports', async () => {
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

#: src/HomePage.tsx:10
msgid "Hello"
msgstr "Hello"
`,
      );

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
        useSuspense: true,
        locales: ['en'],
        projectRoot: tempDir,
      });

      const indexContent = await fs.readFile(
        join(outputDir, 'index.ts'),
        'utf-8',
      );
      expect(indexContent).toContain('@idioma/react/runtime-suspense');
    });
  });
});
