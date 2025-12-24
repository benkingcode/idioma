import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  TranslatedMessage,
  TranslationProvider,
  TranslationRequest,
} from '../../ai/provider';
import { runTranslate, type TranslateResult } from './translate';

// Mock provider for testing
function createMockProvider(
  translations: Record<string, string>,
): TranslationProvider {
  return {
    name: 'mock',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      return request.messages.map((m) => ({
        key: m.key,
        translation: translations[m.source] || `[translated] ${m.source}`,
      }));
    },
  };
}

describe('Translate Command', () => {
  let tempDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-translate-'));
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('translates untranslated messages', async () => {
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

    const provider = createMockProvider({ Hello: 'Hola' });

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
    });

    expect(result.translated).toBe(1);

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr "Hola"');
  });

  it('skips already translated messages', async () => {
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

    const provider = createMockProvider({});

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
    });

    expect(result.translated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('respects force option to retranslate', async () => {
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola viejo"
`,
    );

    const provider = createMockProvider({ Hello: 'Hola nuevo' });

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
      force: true,
    });

    expect(result.translated).toBe(1);

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr "Hola nuevo"');
  });

  it('dry run does not write changes', async () => {
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

    const provider = createMockProvider({ Hello: 'Hola' });

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
      dryRun: true,
    });

    expect(result.translated).toBe(1);
    expect(result.dryRun).toBe(true);

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr ""');
  });

  it('translates multiple messages in batch', async () => {
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

msgid "Welcome"
msgstr ""
`,
    );

    const provider = createMockProvider({
      Hello: 'Hola',
      Goodbye: 'Adiós',
      Welcome: 'Bienvenido',
    });

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
    });

    expect(result.translated).toBe(3);

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr "Hola"');
    expect(esContent).toContain('msgstr "Adiós"');
    expect(esContent).toContain('msgstr "Bienvenido"');
  });

  it('marks AI translations with a flag', async () => {
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

    const provider = createMockProvider({ Hello: 'Hola' });

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
      markAI: true,
    });

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('#, ai-translated');
  });

  it('returns stats about translation', async () => {
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr ""

msgid "Goodbye"
msgstr "Adiós"

msgid "Welcome"
msgstr ""
`,
    );

    const provider = createMockProvider({
      Hello: 'Hola',
      Welcome: 'Bienvenido',
    });

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
    });

    expect(result.translated).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(3);
  });
});
