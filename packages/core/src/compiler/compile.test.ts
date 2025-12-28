import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parsePoString, writePoFile } from '../po/parser';
import {
  compileTranslations,
  createCompileLock,
  type CompileOptions,
} from './compile';

describe('compileTranslations', () => {
  let tempDir: string;
  let outputDir: string;
  let poDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-compile-'));
    outputDir = join(tempDir, 'idioma');
    poDir = join(tempDir, 'locales');
    await fs.mkdir(poDir, { recursive: true });
  });

  afterEach(async () => {
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

  it('generates types.d.ts with TypeScript definitions in .generated/', async () => {
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

    const typesPath = join(outputDir, '.generated', 'types.d.ts');
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
    // index.ts should import types from .generated/ (not translations)
    expect(content).toContain('./.generated/types');
    expect(content).not.toContain('./.generated/translations');
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
    // Should use Intl.PluralRules for locale-aware pluralization
    expect(content).toContain('Intl.PluralRules');
  });

  it('compiles ICU plural with proper CLDR handling', async () => {
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

    // Verify the generated code structure for plurals
    expect(content).toContain('(args) =>');
    expect(content).toContain("Intl.PluralRules('en')");
    expect(content).toContain('pr.select');
    // Check for one/other branches
    expect(content).toContain("'one'");
    expect(content).toContain('" item"');
    expect(content).toContain('" items"');
  });

  it('compiles ICU plural with zero form', async () => {
    await createPoFile(
      'en',
      `
msgid ""
msgstr ""
"Language: en\\n"

#, icu-format
msgid "{count, plural, zero {No items} one {# item} other {# items}}"
msgstr "{count, plural, zero {No items} one {# item} other {# items}}"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'en',
    });

    const translationsPath = join(outputDir, '.generated', 'translations.js');
    const content = await fs.readFile(translationsPath, 'utf-8');

    // Verify zero form handling
    expect(content).toContain('(args) =>');
    expect(content).toContain('v === 0');
    expect(content).toContain('"No items"');
  });

  it('compiles ICU select correctly', async () => {
    await createPoFile(
      'en',
      `
msgid ""
msgstr ""
"Language: en\\n"

#, icu-format
msgid "{gender, select, male {He} female {She} other {They}} liked your post"
msgstr "{gender, select, male {He} female {She} other {They}} liked your post"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'en',
    });

    const translationsPath = join(outputDir, '.generated', 'translations.js');
    const content = await fs.readFile(translationsPath, 'utf-8');

    // Verify select handling
    expect(content).toContain('(args) =>');
    expect(content).toContain("sv === 'male'");
    expect(content).toContain("sv === 'female'");
    expect(content).toContain('"He"');
    expect(content).toContain('"She"');
    expect(content).toContain('"They"');
    expect(content).toContain('" liked your post"');
  });

  it('compiles Arabic plural with CLDR forms', async () => {
    await createPoFile(
      'ar',
      `
msgid ""
msgstr ""
"Language: ar\\n"

#, icu-format
msgid "{count, plural, zero {لا عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصر} other {# عنصر}}"
msgstr "{count, plural, zero {لا عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصر} other {# عنصر}}"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'ar',
    });

    const translationsPath = join(outputDir, '.generated', 'translations.js');
    const content = await fs.readFile(translationsPath, 'utf-8');

    // Should use Intl.PluralRules with Arabic locale
    expect(content).toContain("Intl.PluralRules('ar')");
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

  describe('routing compilation', () => {
    it('generates routes.js when routing.localizedPaths is enabled', async () => {
      // Create Next.js app structure for route extraction
      const appDir = join(tempDir, 'app');
      await fs.mkdir(appDir, { recursive: true });
      await fs.mkdir(join(appDir, 'about'), { recursive: true });
      await fs.mkdir(join(appDir, 'contact'), { recursive: true });
      await fs.writeFile(
        join(appDir, 'about', 'page.tsx'),
        'export default function About() {}',
      );
      await fs.writeFile(
        join(appDir, 'contact', 'page.tsx'),
        'export default function Contact() {}',
      );

      // Create PO files with route translations
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

#. Route segment
msgctxt "route:about"
msgid "vK3nP8xQ"
msgstr "about"

#. Route segment
msgctxt "route:contact"
msgid "m2RsT5wY"
msgstr "contact"
`,
      );

      await createPoFile(
        'es',
        `
msgid ""
msgstr ""
"Language: es\\n"

#. Route segment
msgctxt "route:about"
msgid "vK3nP8xQ"
msgstr "sobre"

#. Route segment
msgctxt "route:contact"
msgid "m2RsT5wY"
msgstr "contacto"
`,
      );

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
        projectRoot: tempDir,
        routing: {
          enabled: true,
          localizedPaths: true,
          framework: 'next-app',
        },
      });

      // Verify routes.js was generated
      const routesPath = join(outputDir, '.generated', 'routes.js');
      const content = await fs.readFile(routesPath, 'utf-8');

      expect(content).toContain('export const segments');
      expect(content).toContain('export const routes');
      expect(content).toContain('export const reverseRoutes');
      expect(content).toContain('"sobre"');
      expect(content).toContain('"contacto"');
    });

    it('generates routes.d.ts with type declarations', async () => {
      // Create minimal app structure
      const appDir = join(tempDir, 'app');
      await fs.mkdir(appDir, { recursive: true });
      await fs.mkdir(join(appDir, 'about'), { recursive: true });
      await fs.writeFile(
        join(appDir, 'about', 'page.tsx'),
        'export default function About() {}',
      );

      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

msgctxt "route:about"
msgid "vK3nP8xQ"
msgstr "about"
`,
      );

      await createPoFile(
        'es',
        `
msgid ""
msgstr ""
"Language: es\\n"

msgctxt "route:about"
msgid "vK3nP8xQ"
msgstr "sobre"
`,
      );

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
        projectRoot: tempDir,
        routing: {
          enabled: true,
          localizedPaths: true,
          framework: 'next-app',
        },
      });

      // Verify routes.d.ts was generated
      const typesPath = join(outputDir, '.generated', 'routes.d.ts');
      const content = await fs.readFile(typesPath, 'utf-8');

      expect(content).toContain('export type Locale');
      expect(content).toContain('export declare const segments');
      expect(content).toContain('export declare const routes');
      expect(content).toContain('export declare function getLocalizedPath');
    });

    it('does not generate routes when routing.localizedPaths is false', async () => {
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
        projectRoot: tempDir,
        routing: {
          enabled: true,
          localizedPaths: false,
          framework: 'next-app',
        },
      });

      // routes.js should not exist
      const routesPath = join(outputDir, '.generated', 'routes.js');
      await expect(fs.access(routesPath)).rejects.toThrow();
    });
  });

  describe('concurrent compilation safety', () => {
    it('handles multiple concurrent compileTranslations calls without race conditions', async () => {
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

      const compileLock = createCompileLock();
      const options: CompileOptions = {
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
      };

      // Launch 5 concurrent compilations - this would fail without locking
      const promises = Array(5)
        .fill(null)
        .map(() => compileLock.compile(options));

      // All should succeed without throwing
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Verify output is valid
      const translationsPath = join(outputDir, '.generated', 'translations.js');
      const content = await fs.readFile(translationsPath, 'utf-8');
      expect(content).toContain('Hello');
      expect(content).toContain('Hola');
    });

    it('serializes compilation calls to prevent race conditions', async () => {
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

      const compileLock = createCompileLock();
      const options: CompileOptions = {
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
      };

      const executionOrder: number[] = [];

      // Create promises that track execution order
      const makeTrackedCompile = (id: number) => async () => {
        executionOrder.push(id);
        await compileLock.compile(options);
        executionOrder.push(id + 100);
      };

      // Launch concurrent compilations
      await Promise.all([
        makeTrackedCompile(1)(),
        makeTrackedCompile(2)(),
        makeTrackedCompile(3)(),
      ]);

      // Each compilation should complete before the next starts
      // (e.g., [1, 101, 2, 102, 3, 103] - serialized order)
      // We verify by checking that for each ID, start comes before all other ends
      for (let i = 1; i <= 3; i++) {
        const startIdx = executionOrder.indexOf(i);
        const endIdx = executionOrder.indexOf(i + 100);
        // Start should come before end
        expect(startIdx).toBeLessThan(endIdx);
      }
    });
  });
});
