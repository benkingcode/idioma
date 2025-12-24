import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runStats } from './stats';

describe('Stats Command', () => {
  let tempDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-stats-'));
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns stats for all locales', async () => {
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

    const result = await runStats({ localeDir });

    expect(result.locales).toHaveLength(2);
    expect(result.locales.map((l) => l.locale)).toContain('en');
    expect(result.locales.map((l) => l.locale)).toContain('es');
  });

  it('calculates message counts correctly', async () => {
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

msgid "Goodbye"
msgstr "Goodbye"
`,
    );

    const result = await runStats({ localeDir });

    expect(result.totalMessages).toBe(3);
    expect(result.locales[0].total).toBe(3);
  });

  it('calculates translation percentage', async () => {
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

    const result = await runStats({ localeDir });

    const enStats = result.locales.find((l) => l.locale === 'en');
    const esStats = result.locales.find((l) => l.locale === 'es');

    expect(enStats?.percentage).toBe(100);
    expect(esStats?.percentage).toBe(50);
  });

  it('counts fuzzy translations', async () => {
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#, fuzzy
msgid "Hello"
msgstr "Hola"

msgid "World"
msgstr "Mundo"
`,
    );

    const result = await runStats({ localeDir });

    const esStats = result.locales.find((l) => l.locale === 'es');
    expect(esStats?.fuzzy).toBe(1);
  });

  it('returns overall completion percentage', async () => {
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

    const result = await runStats({ localeDir });

    expect(result.overallPercentage).toBe(100);
  });

  it('handles empty translations', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr ""
`,
    );

    const result = await runStats({ localeDir });

    expect(result.locales[0].missing).toBe(1);
    expect(result.locales[0].translated).toBe(0);
  });
});
