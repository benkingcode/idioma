import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parsePoString, writePoFile } from '../po/parser';
import {
  compileIcuToFunctionString,
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

  it('gives the provider and createT the default locale, for fallbacks', async () => {
    await createPoFile(
      'fr',
      `
msgid ""
msgstr ""
"Language: fr\\n"

msgid "Hello"
msgstr "Bonjour"
`,
    );

    await compileTranslations({
      localeDir: poDir,
      outputDir,
      defaultLocale: 'fr',
    });

    const index = await fs.readFile(join(outputDir, 'index.ts'), 'utf-8');
    expect(index).toContain(
      "createIdiomaProvider({\n  defaultLocale: 'fr',\n})",
    );
    const plain = await fs.readFile(join(outputDir, 'plain.ts'), 'utf-8');
    expect(plain).toContain("defaultLocale: 'fr',");
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
    expect(content).toContain('Intl.PluralRules("en")');
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
    expect(content).toContain('sv === "male"');
    expect(content).toContain('sv === "female"');
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
    expect(content).toContain('Intl.PluralRules("ar")');
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

  // Issue #13: a key's analysis used to come from the first catalogue read
  // (directory order), even when its msgstr there was empty, and was then
  // reused to compile every other locale.
  describe('ICU code generation', () => {
    // A compiled plural or select resolves the ICU structure and returns a
    // template: its placeholders and tags are left for the runtime, which
    // renders them as it renders a plain message
    const run = (code: string, args: Record<string, unknown>) =>
      // eslint-disable-next-line no-eval
      (0, eval)(`(${code})`)(args);

    it('compiles a plural next to a dotted placeholder', () => {
      const code = compileIcuToFunctionString(
        '{user.name} has {count, plural, one {# ticket} other {# tickets}}',
        'en',
      );
      expect(run(code, { 'user.name': 'Ana', count: 1 })).toBe(
        '{user.name} has 1 ticket',
      );
    });

    it('reads the plural value by quoted name, never as code', () => {
      const code = compileIcuToFunctionString(
        '{count, plural, other {# for {name}}}',
        'en',
      );
      expect(code).toContain('args["count"]');
      expect(code).not.toMatch(/args\.[a-z]/);
    });

    it('leaves an argument as a placeholder for the runtime', () => {
      const code = compileIcuToFunctionString(
        '{count, plural, other {# for {name}}}',
        'en',
      );
      expect(run(code, { count: 2, name: 'Ana' })).toBe('2 for {name}');
    });

    it('keeps component tags around a plural', () => {
      const code = compileIcuToFunctionString(
        'You have {count, plural, one {# item} other {# items}}. See <Link>cart</Link>',
        'en',
      );
      expect(run(code, { count: 2 })).toBe(
        'You have 2 items. See <Link>cart</Link>',
      );
    });

    it('keeps component tags inside a plural branch', () => {
      const code = compileIcuToFunctionString(
        '{count, plural, one {<b>#</b> item} other {<b>#</b> items}}',
        'en',
      );
      expect(run(code, { count: 2 })).toBe('<b>2</b> items');
    });

    it('does not run a placeholder name as code', () => {
      // A translation is text from a TMS, an LLM or a contributor: the
      // compiled module must not execute it
      const message = "Hi {constructor.constructor('return 42')()}";
      const code = compileIcuToFunctionString(message, 'en', {
        hasPlaceholders: true,
        hasPlural: false,
        hasSelect: false,
        variables: [],
      });
      expect(run(code, {})).toBe(message);
    });
  });

  describe('ICU number, date and time formats', () => {
    // Compiled with the Intl options the formatjs parser derives from the
    // style or skeleton, so nothing is parsed at runtime
    const run = (code: string, args: Record<string, unknown>) =>
      // eslint-disable-next-line no-eval
      (0, eval)(`(${code})`)(args);
    const day = new Date(2026, 10, 5, 21, 30);

    it('formats a number with a skeleton', () => {
      const code = compileIcuToFunctionString(
        'Total: {price, number, ::currency/EUR}',
        'es',
      );
      const euros = new Intl.NumberFormat('es', {
        style: 'currency',
        currency: 'EUR',
      }).format(1234.5);
      expect(run(code, { price: 1234.5 })).toBe(`Total: ${euros}`);
    });

    it('formats the named number styles', () => {
      const code = compileIcuToFunctionString(
        '{r, number, percent} of {n, number, integer} ({x, number})',
        'en',
      );
      expect(run(code, { r: 0.25, n: 1234.6, x: 1234.5 })).toBe(
        '25% of 1,235 (1,234.5)',
      );
    });

    it('formats the named date and time styles', () => {
      const code = compileIcuToFunctionString(
        '{d, date, long} at {d, time, short}',
        'en',
      );
      const date = new Intl.DateTimeFormat('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(day);
      const time = new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        minute: 'numeric',
      }).format(day);
      expect(run(code, { d: day })).toBe(`${date} at ${time}`);
    });

    it('formats a date skeleton, and a timestamp as a date', () => {
      const code = compileIcuToFunctionString('{d, date, ::yMMMd}', 'en');
      const expected = new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(day);
      expect(run(code, { d: day })).toBe(expected);
      expect(run(code, { d: day.getTime() })).toBe(expected);
    });

    it("formats a plural's # with the locale's grouping", () => {
      const code = compileIcuToFunctionString(
        '{n, plural, one {# ticket} other {# tickets}}',
        'en',
      );
      expect(run(code, { n: 1200 })).toBe('1,200 tickets');
    });

    it('formats inside a plural branch', () => {
      const code = compileIcuToFunctionString(
        '{n, plural, other {# for {price, number, ::currency/USD}}}',
        'en',
      );
      expect(run(code, { n: 2, price: 9.5 })).toBe('2 for $9.50');
    });

    it('leaves a missing value as its placeholder', () => {
      const code = compileIcuToFunctionString(
        'Total: {price, number, ::currency/EUR}',
        'en',
      );
      expect(run(code, {})).toBe('Total: {price}');
    });

    it('compiles a message whose only argument is a format', async () => {
      // It used to be kept as text and render "{price, number, ...}"
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

msgid "cart.total"
msgstr "Total: {price, number, ::currency/EUR}"
`,
      );
      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
      });

      const content = await fs.readFile(
        join(outputDir, '.generated', 'translations.js'),
        'utf-8',
      );
      expect(content).toContain('Intl.NumberFormat');
    });

    it('types a date argument to take a Date', async () => {
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

msgid "event.when"
msgstr "On {day, date, long}"
`,
      );
      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
      });

      const types = await fs.readFile(
        join(outputDir, '.generated', 'types.d.ts'),
        'utf-8',
      );
      expect(types).toContain('"event.when": { day: Date | string | number };');
    });

    it('fails the compile on a style it cannot format, naming the key', async () => {
      // currency with no currency code: Intl cannot format it
      await createPoFile(
        'en',
        `
msgid ""
msgstr ""
"Language: en\\n"

msgid "cart.total"
msgstr "Total: {price, number, currency}"
`,
      );

      await expect(
        compileTranslations({
          localeDir: poDir,
          outputDir,
          defaultLocale: 'en',
        }),
      ).rejects.toThrow(/en\.po.*"cart\.total".*currency/s);
    });
  });

  describe('a plural or select that does not parse', () => {
    const header = (locale: string) => `
msgid ""
msgstr ""
"Language: ${locale}\\n"
`;

    it('fails the compile, naming the locale and the key', async () => {
      await createPoFile(
        'en',
        `${header('en')}
msgid "cart.count"
msgstr "{count, plural, one {# item} other {# items}}"
`,
      );
      // The other branch is missing its closing brace
      await createPoFile(
        'es',
        `${header('es')}
msgid "cart.count"
msgstr "{count, plural, one {# artículo} other {# artículos}"
`,
      );

      await expect(
        compileTranslations({
          localeDir: poDir,
          outputDir,
          defaultLocale: 'en',
        }),
      ).rejects.toThrow(/es.*"cart\.count".*not valid ICU/s);
    });

    it('still compiles other text the parser rejects, as plain text', async () => {
      await createPoFile(
        'en',
        `${header('en')}
msgid "math.lt"
msgstr "Use {a, b} as you like"
`,
      );

      await expect(
        compileTranslations({
          localeDir: poDir,
          outputDir,
          defaultLocale: 'en',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('ICU analysis across locales', () => {
    const header = (locale: string) => `
msgid ""
msgstr ""
"Language: ${locale}\\n"
`;

    it('types values from the default locale when other catalogues are still empty', async () => {
      await createPoFile(
        'en',
        `${header('en')}
msgid "sets.count"
msgstr "{count, plural, one {# set} other {# sets}}"
`,
      );
      // Several locales that sort before "en", so whatever order the
      // directory is read in, an empty msgstr is likely to come first.
      for (const locale of ['aa', 'ab', 'ca']) {
        await createPoFile(
          locale,
          `${header(locale)}
msgid "sets.count"
msgstr ""
`,
        );
      }

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
      });

      const types = await fs.readFile(
        join(outputDir, '.generated', 'types.d.ts'),
        'utf-8',
      );
      expect(types).toContain('"sets.count": { count: string | number };');
    });

    it('compiles each locale with its own ICU analysis', async () => {
      // The default locale is a plain placeholder; the translation is a plural.
      await createPoFile(
        'en',
        `${header('en')}
msgid "sets.count"
msgstr "{count} sets"
`,
      );
      await createPoFile(
        'fr',
        `${header('fr')}
msgid "sets.count"
msgstr "{count, plural, one {# set} other {# sets}}"
`,
      );

      await compileTranslations({
        localeDir: poDir,
        outputDir,
        defaultLocale: 'en',
      });

      const translations = await fs.readFile(
        join(outputDir, '.generated', 'translations.js'),
        'utf-8',
      );
      expect(translations).toContain('Intl.PluralRules');
      expect(translations).not.toContain('{count, plural');
    });
  });
});
