import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IdiomaConfig } from '../config';
import { runInit } from './init';

describe('Init Command', () => {
  let tempDir: string;
  let idiomaDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-init-'));
    idiomaDir = join(tempDir, 'src', 'idioma');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function makeConfig(overrides?: Partial<IdiomaConfig>): IdiomaConfig {
    return {
      idiomaDir,
      defaultLocale: 'en',
      locales: ['en', 'es'],
      ...overrides,
    };
  }

  it('creates complete directory structure', async () => {
    const config = makeConfig();
    await runInit({ cwd: tempDir, config });

    // idiomaDir exists
    const idiomaStat = await fs.stat(idiomaDir);
    expect(idiomaStat.isDirectory()).toBe(true);

    // locales/ exists
    const localesStat = await fs.stat(join(idiomaDir, 'locales'));
    expect(localesStat.isDirectory()).toBe(true);

    // .generated/ exists
    const generatedStat = await fs.stat(join(idiomaDir, '.generated'));
    expect(generatedStat.isDirectory()).toBe(true);

    // .gitignore exists
    const gitignore = await fs.readFile(join(idiomaDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.generated/');
  });

  it('creates empty PO files for all configured locales', async () => {
    const config = makeConfig({ locales: ['en', 'es', 'fr'] });
    await runInit({ cwd: tempDir, config });

    for (const locale of ['en', 'es', 'fr']) {
      const poContent = await fs.readFile(
        join(idiomaDir, 'locales', `${locale}.po`),
        'utf-8',
      );
      expect(poContent).toContain(`Language: ${locale}`);
      // Should have no actual messages (only the header entry)
      expect(poContent).not.toMatch(/^msgid "[^"]+"/m);
    }
  });

  it('generates index.ts with typed exports', async () => {
    const config = makeConfig();
    await runInit({ cwd: tempDir, config });

    const content = await fs.readFile(join(idiomaDir, 'index.ts'), 'utf-8');
    expect(content).toContain('export const Trans = createTrans');
    expect(content).toContain('export const useT = createUseT');
    expect(content).toContain(
      'export const IdiomaProvider = createIdiomaProvider',
    );
    expect(content).toContain('export const useLocale = createUseLocale');
    expect(content).toContain('export type {');
  });

  it('generates plain.ts with createT factory', async () => {
    const config = makeConfig();
    await runInit({ cwd: tempDir, config });

    const content = await fs.readFile(join(idiomaDir, 'plain.ts'), 'utf-8');
    expect(content).toContain('createT');
    expect(content).toContain('_createTFactory');
  });

  it('generates types.d.ts with empty TranslationKey', async () => {
    const config = makeConfig();
    await runInit({ cwd: tempDir, config });

    const content = await fs.readFile(
      join(idiomaDir, '.generated', 'types.d.ts'),
      'utf-8',
    );
    expect(content).toContain('TranslationKey = never');
    expect(content).toContain('"en"');
    expect(content).toContain('"es"');
  });

  it('generates empty translations.js', async () => {
    const config = makeConfig();
    await runInit({ cwd: tempDir, config });

    const content = await fs.readFile(
      join(idiomaDir, '.generated', 'translations.js'),
      'utf-8',
    );
    expect(content).toContain('export const translations');
  });

  it('does not overwrite existing PO files', async () => {
    const localeDir = join(idiomaDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });

    const existingContent = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`;
    await fs.writeFile(join(localeDir, 'en.po'), existingContent);

    const config = makeConfig();
    await runInit({ cwd: tempDir, config });

    const afterInit = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    // Original content preserved (has the "Hello" message)
    expect(afterInit).toContain('Hello');
  });

  it('creates missing PO files while preserving existing ones', async () => {
    const localeDir = join(idiomaDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });

    const existingContent = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`;
    await fs.writeFile(join(localeDir, 'en.po'), existingContent);

    const config = makeConfig({ locales: ['en', 'es'] });
    await runInit({ cwd: tempDir, config });

    // en.po preserved
    const enContent = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    expect(enContent).toContain('Hello');

    // es.po created fresh
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('Language: es');
  });

  it('works with custom localesDir', async () => {
    const customLocalesDir = join(tempDir, 'custom-locales');
    const config = makeConfig({ localesDir: customLocalesDir });
    await runInit({ cwd: tempDir, config });

    // PO files in custom directory
    const enPo = await fs.readFile(join(customLocalesDir, 'en.po'), 'utf-8');
    expect(enPo).toContain('Language: en');

    // Generated files still in idiomaDir
    const indexTs = await fs.readFile(join(idiomaDir, 'index.ts'), 'utf-8');
    expect(indexTs).toContain('createTrans');
  });

  it('works with useSuspense', async () => {
    const config = makeConfig({ useSuspense: true });
    await runInit({ cwd: tempDir, config });

    const content = await fs.readFile(join(idiomaDir, 'index.ts'), 'utf-8');
    expect(content).toContain('createTransSuspense');
    expect(content).toContain('createUseTSuspense');
  });

  it('falls back to defaultLocale when locales not specified', async () => {
    const config = makeConfig({ locales: undefined });
    await runInit({ cwd: tempDir, config });

    const localeDir = join(idiomaDir, 'locales');
    const files = await fs.readdir(localeDir);
    const poFiles = files.filter((f) => f.endsWith('.po'));
    expect(poFiles).toEqual(['en.po']);
  });

  it('is idempotent — running twice produces same result', async () => {
    const config = makeConfig();

    await runInit({ cwd: tempDir, config });
    const firstIndex = await fs.readFile(join(idiomaDir, 'index.ts'), 'utf-8');
    const firstTypes = await fs.readFile(
      join(idiomaDir, '.generated', 'types.d.ts'),
      'utf-8',
    );

    await runInit({ cwd: tempDir, config });
    const secondIndex = await fs.readFile(join(idiomaDir, 'index.ts'), 'utf-8');
    const secondTypes = await fs.readFile(
      join(idiomaDir, '.generated', 'types.d.ts'),
      'utf-8',
    );

    expect(secondIndex).toBe(firstIndex);
    expect(secondTypes).toBe(firstTypes);
  });

  it('returns result with created locales and skipped locales', async () => {
    const localeDir = join(idiomaDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `msgid ""\nmsgstr ""\n"Language: en\\n"\n`,
    );

    const config = makeConfig({ locales: ['en', 'es'] });
    const result = await runInit({ cwd: tempDir, config });

    expect(result.createdLocales).toContain('es');
    expect(result.skippedLocales).toContain('en');
  });
});
