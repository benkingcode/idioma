import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheck, type CheckResult } from './check';

describe('Check Command', () => {
  let tempDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-check-'));
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns success when all messages are translated', async () => {
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

    const result = await runCheck({ localeDir });

    expect(result.complete).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns failure when translations are missing', async () => {
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
msgstr ""
`,
    );

    const result = await runCheck({ localeDir });

    expect(result.complete).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing[0].locale).toBe('es');
    expect(result.missing[0].key).toBe('Hello');
  });

  it('reports fuzzy messages as incomplete', async () => {
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

#, fuzzy
msgid "Hello"
msgstr "Hola"
`,
    );

    const result = await runCheck({ localeDir });

    expect(result.complete).toBe(false);
    expect(result.fuzzy.length).toBeGreaterThan(0);
    expect(result.fuzzy[0].locale).toBe('es');
    expect(result.fuzzy[0].key).toBe('Hello');
  });

  it('checks specific locale when provided', async () => {
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
msgstr ""
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

    const result = await runCheck({ localeDir, locale: 'fr' });

    expect(result.complete).toBe(true);
  });

  it('reports multiple missing translations', async () => {
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
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr ""

msgid "Goodbye"
msgstr ""
`,
    );

    const result = await runCheck({ localeDir });

    expect(result.missing.length).toBe(2);
    const keys = result.missing.map((m) => m.key);
    expect(keys).toContain('Hello');
    expect(keys).toContain('Goodbye');
  });

  it('includes translation stats in result', async () => {
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

    const result = await runCheck({ localeDir });

    expect(result.stats).toBeDefined();
    expect(result.stats.es.total).toBe(2);
    expect(result.stats.es.translated).toBe(1);
    expect(result.stats.es.missing).toBe(1);
  });
});
