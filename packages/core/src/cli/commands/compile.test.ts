import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compileCommand, runCompile } from './compile';

describe('Compile Command', () => {
  let tempDir: string;
  let localeDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-compile-'));
    localeDir = join(tempDir, 'locales');
    outputDir = join(tempDir, 'idioma');
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('compiles PO files to output directory', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`,
    );

    await runCompile({
      localeDir,
      outputDir,
      defaultLocale: 'en',
    });

    // User-facing files at outputDir root
    const rootFiles = await fs.readdir(outputDir);
    expect(rootFiles).toContain('index.ts');

    // Internal files in .generated/
    const generatedFiles = await fs.readdir(join(outputDir, '.generated'));
    expect(generatedFiles).toContain('translations.js');
    expect(generatedFiles).toContain('translations.d.ts');
    expect(generatedFiles).toContain('types.ts');
  });

  it('generates translations.js with all locales', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
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
`,
    );

    await runCompile({
      localeDir,
      outputDir,
      defaultLocale: 'en',
    });

    const content = await fs.readFile(
      join(outputDir, '.generated', 'translations.js'),
      'utf-8',
    );
    expect(content).toContain('Hello');
    expect(content).toContain('Hola');
    expect(content).toContain('"en"');
    expect(content).toContain('"es"');
  });

  it('generates types.ts with Locale type', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'fr.po'),
      `
msgid ""
msgstr ""
"Language: fr\\n"

msgid "Hello"
msgstr "Bonjour"
`,
    );

    await runCompile({
      localeDir,
      outputDir,
      defaultLocale: 'en',
    });

    const content = await fs.readFile(
      join(outputDir, '.generated', 'types.ts'),
      'utf-8',
    );
    expect(content).toContain('Locale');
    expect(content).toContain('"en"');
    expect(content).toContain('"fr"');
  });

  it('generates TranslationKey type from messages', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"

msgid "Goodbye"
msgstr "Goodbye"
`,
    );

    await runCompile({
      localeDir,
      outputDir,
      defaultLocale: 'en',
    });

    const content = await fs.readFile(
      join(outputDir, '.generated', 'types.ts'),
      'utf-8',
    );
    expect(content).toContain('TranslationKey');
    expect(content).toContain('"Hello"');
    expect(content).toContain('"Goodbye"');
  });

  it('generates index.ts with exports', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`,
    );

    await runCompile({
      localeDir,
      outputDir,
      defaultLocale: 'en',
    });

    const content = await fs.readFile(join(outputDir, 'index.ts'), 'utf-8');
    expect(content).toContain('export const Trans = createTrans');
    expect(content).toContain('export const useT = createUseT');
    expect(content).toContain(
      'export const IdiomaProvider = createIdiomaProvider',
    );
    expect(content).toContain('export type {');
    // index.ts should import from .generated/
    expect(content).toContain('./.generated/translations');
  });

  it('returns compile result with stats', async () => {
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

    const result = await runCompile({
      localeDir,
      outputDir,
      defaultLocale: 'en',
    });

    expect(result.messageCount).toBe(2);
    expect(result.locales).toContain('en');
  });
});
