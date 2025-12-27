import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ContextProvider,
  FileContextRequest,
  GeneratedContext,
} from '../../ai/context';
import type {
  TranslatedMessage,
  TranslationProvider,
  TranslationRequest,
} from '../../ai/provider';
import {
  runTranslate,
  runTranslateAll,
  type TranslateResult,
} from './translate';

// Mock provider that translates based on source text lookup
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

  it('translates using source text from default locale when msgid is a hash', async () => {
    // This test verifies the core Idioma hash-based key system:
    // - msgid is a content-addressable hash (e.g., "abc123")
    // - msgstr in default locale contains the actual source text
    // - msgstr in target locale should be the translation
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "abc123"
msgstr "Hello, world!"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "abc123"
msgstr ""
`,
    );

    // The provider should receive "Hello, world!" as source, not "abc123"
    const provider = createMockProvider({ 'Hello, world!': '¡Hola, mundo!' });

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
    });

    expect(result.translated).toBe(1);

    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr "¡Hola, mundo!"');
  });

  it('translates untranslated messages', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
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
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
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
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
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
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
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
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"

msgid "h002"
msgstr "Goodbye"

msgid "h003"
msgstr "Welcome"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""

msgid "h002"
msgstr ""

msgid "h003"
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
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
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
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"

msgid "h002"
msgstr "Goodbye"

msgid "h003"
msgstr "Welcome"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""

msgid "h002"
msgstr "Adiós"

msgid "h003"
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

describe('Translate with Verbose Logging', () => {
  let tempDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-translate-verbose-'));
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('calls onVerbose with batch progress when verbose is enabled', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""
`,
    );

    const provider = createMockProvider({ Hello: 'Hola' });
    const onVerbose = vi.fn();

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
      onVerbose,
    });

    // Should have been called with batch header and response
    expect(onVerbose).toHaveBeenCalled();
    const calls = onVerbose.mock.calls.map((c) => c[0]);

    // Check for batch header
    expect(calls.some((msg) => msg.includes('Translation Batch'))).toBe(true);

    // Check for response with translation
    expect(calls.some((msg) => msg.includes('Hola'))).toBe(true);
  });

  it('does not call onVerbose when not provided', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""
`,
    );

    const provider = createMockProvider({ Hello: 'Hola' });

    // Should not throw when onVerbose is not provided
    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
    });

    expect(result.translated).toBe(1);
  });

  it('logs batch progress for multiple batches', async () => {
    // Create 3 messages to translate
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"

msgid "h002"
msgstr "Goodbye"

msgid "h003"
msgstr "Welcome"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""

msgid "h002"
msgstr ""

msgid "h003"
msgstr ""
`,
    );

    const provider = createMockProvider({
      Hello: 'Hola',
      Goodbye: 'Adiós',
      Welcome: 'Bienvenido',
    });
    const onVerbose = vi.fn();

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
      batchSize: 2, // Force 2 batches
      onVerbose,
    });

    const calls = onVerbose.mock.calls.map((c) => c[0]);

    // Should have batch 1/2 and batch 2/2
    expect(calls.some((msg) => msg.includes('Batch 1/2'))).toBe(true);
    expect(calls.some((msg) => msg.includes('Batch 2/2'))).toBe(true);
  });

  it('works with dry-run mode', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""
`,
    );

    const provider = createMockProvider({ Hello: 'Hola' });
    const onVerbose = vi.fn();

    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider,
      dryRun: true,
      onVerbose,
    });

    // Verbose should still be called in dry-run mode
    expect(onVerbose).toHaveBeenCalled();
    expect(result.dryRun).toBe(true);

    // File should not be modified
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr ""');
  });
});

describe('Translate with Auto-Context', () => {
  let tempDir: string;
  let idiomaDir: string;
  let localeDir: string;
  let srcDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-translate-ctx-'));
    idiomaDir = join(tempDir, 'idioma');
    localeDir = join(idiomaDir, 'locales');
    srcDir = join(tempDir, 'src');
    await fs.mkdir(localeDir, { recursive: true });
    await fs.mkdir(srcDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createMockTranslateProvider(
    translations: Record<string, string>,
  ): TranslationProvider {
    return {
      name: 'mock',
      async translate(
        request: TranslationRequest,
      ): Promise<TranslatedMessage[]> {
        return request.messages.map((m) => ({
          key: m.key,
          translation: translations[m.source] || `[translated] ${m.source}`,
        }));
      },
    };
  }

  function createMockContextProvider(
    contexts: Record<string, string>,
  ): ContextProvider {
    return {
      generateContext: vi
        .fn()
        .mockImplementation(
          async (request: FileContextRequest): Promise<GeneratedContext[]> => {
            return request.messages.map((m) => ({
              key: m.key,
              context: contexts[m.key] ?? 'Default context',
            }));
          },
        ),
    };
  }

  it('generates context before translation when autoContext is enabled', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      'const App = () => <button>Click me</button>;',
    );

    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#: src/App.tsx:1
msgid "h001"
msgstr "Click me"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#: src/App.tsx:1
msgid "h001"
msgstr ""
`,
    );

    const translateProvider = createMockTranslateProvider({
      'Click me': 'Haz clic aquí',
    });
    const contextProvider = createMockContextProvider({
      h001: 'Button label for primary action',
    });

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider: translateProvider,
      autoContext: true,
      contextProvider,
      projectRoot: tempDir,
      idiomaDir,
    });

    // Context provider should have been called
    expect(contextProvider.generateContext).toHaveBeenCalled();

    // AI context should be written to SOURCE locale (en.po)
    const enContent = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    expect(enContent).toContain('[AI Context]:');

    // Target locale should have translation but NOT AI context
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).not.toContain('[AI Context]:');
    expect(esContent).toContain('msgstr "Haz clic aquí"');
  });

  it('skips context generation when autoContext is false', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      'const App = () => <button>Click me</button>;',
    );

    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#: src/App.tsx:1
msgid "h001"
msgstr "Click me"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#: src/App.tsx:1
msgid "h001"
msgstr ""
`,
    );

    const translateProvider = createMockTranslateProvider({
      'Click me': 'Haz clic aquí',
    });
    const contextProvider = createMockContextProvider({});

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider: translateProvider,
      autoContext: false,
      contextProvider,
      projectRoot: tempDir,
    });

    // Context provider should NOT have been called
    expect(contextProvider.generateContext).not.toHaveBeenCalled();
  });

  it('uses existing context without regenerating', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      'const App = () => <button>Click me</button>;',
    );

    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#. [AI Context]: Pre-existing context
#: src/App.tsx:1
msgid "h001"
msgstr "Click me"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#. [AI Context]: Pre-existing context
#: src/App.tsx:1
msgid "h001"
msgstr ""
`,
    );

    const translateProvider = createMockTranslateProvider({
      'Click me': 'Haz clic aquí',
    });
    const contextProvider = createMockContextProvider({});

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider: translateProvider,
      autoContext: true,
      contextProvider,
      projectRoot: tempDir,
    });

    // Context provider should NOT have been called (message already has context)
    expect(contextProvider.generateContext).not.toHaveBeenCalled();
  });

  it('respects explicit context (msgctxt) over AI context', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      'const App = () => <button>Click me</button>;',
    );

    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#: src/App.tsx:1
msgctxt "button"
msgid "h001"
msgstr "Click me"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#: src/App.tsx:1
msgctxt "button"
msgid "h001"
msgstr ""
`,
    );

    const translateProvider = createMockTranslateProvider({
      'Click me': 'Haz clic aquí',
    });
    const contextProvider = createMockContextProvider({});

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider: translateProvider,
      autoContext: true,
      contextProvider,
      projectRoot: tempDir,
    });

    // Context provider should NOT have been called (message has explicit context)
    expect(contextProvider.generateContext).not.toHaveBeenCalled();
  });

  it('silently handles missing source files', async () => {
    // Don't create the source file

    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#: src/NonExistent.tsx:1
msgid "h001"
msgstr "Missing file"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#: src/NonExistent.tsx:1
msgid "h001"
msgstr ""
`,
    );

    const translateProvider = createMockTranslateProvider({
      'Missing file': 'Archivo faltante',
    });
    const contextProvider = createMockContextProvider({});

    // Should not throw
    const result = await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider: translateProvider,
      autoContext: true,
      contextProvider,
      projectRoot: tempDir,
    });

    // Translation should still complete
    expect(result.translated).toBe(1);
  });

  it('writes AI context to source locale, not target locale', async () => {
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      'const App = () => <button>Click me</button>;',
    );

    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#: src/App.tsx:1
msgid "h001"
msgstr "Click me"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#: src/App.tsx:1
msgid "h001"
msgstr ""
`,
    );

    const translateProvider = createMockTranslateProvider({
      'Click me': 'Haz clic aquí',
    });
    const contextProvider = createMockContextProvider({
      h001: 'Button label for primary action',
    });

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider: translateProvider,
      autoContext: true,
      contextProvider,
      projectRoot: tempDir,
      idiomaDir,
    });

    // AI context should be written to SOURCE locale (en.po), not target
    const enContent = await fs.readFile(join(localeDir, 'en.po'), 'utf-8');
    expect(enContent).toContain('[AI Context]:');

    // Target locale should NOT have AI context (only translation)
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).not.toContain('[AI Context]:');
    expect(esContent).toContain('msgstr "Haz clic aquí"');
  });

  it('uses context from source locale when translating', async () => {
    // This test verifies that context from en.po is used for translation,
    // even when translating to a different locale

    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      'const App = () => <button>Submit</button>;',
    );

    // Source locale has pre-existing context
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

#. [AI Context]: Form submit button
#: src/App.tsx:1
msgid "h001"
msgstr "Submit"
`,
    );

    // Target locale has no context
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

#: src/App.tsx:1
msgid "h001"
msgstr ""
`,
    );

    // Track what context the translation provider receives
    let receivedContext: string | undefined;
    const translateProvider: TranslationProvider = {
      name: 'mock',
      async translate(request) {
        receivedContext = request.messages[0]?.context;
        return request.messages.map((m) => ({
          key: m.key,
          translation: 'Enviar',
        }));
      },
    };

    const contextProvider = createMockContextProvider({});

    await runTranslate({
      localeDir,
      defaultLocale: 'en',
      targetLocale: 'es',
      provider: translateProvider,
      autoContext: true,
      contextProvider,
      projectRoot: tempDir,
    });

    // Translation should receive context from source locale
    expect(receivedContext).toContain('[AI Context]: Form submit button');
  });
});

describe('runTranslateAll', () => {
  let tempDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-translate-all-'));
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createMockTranslateProvider(
    translations: Record<string, string>,
  ): TranslationProvider {
    return {
      name: 'mock',
      async translate(
        request: TranslationRequest,
      ): Promise<TranslatedMessage[]> {
        return request.messages.map((m) => ({
          key: m.key,
          translation: translations[m.source] || `[translated] ${m.source}`,
        }));
      },
    };
  }

  it('translates multiple locales', async () => {
    // Create source locale
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );

    // Create target locales
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""
`,
    );
    await fs.writeFile(
      join(localeDir, 'fr.po'),
      `
msgid ""
msgstr ""
"Language: fr\\n"

msgid "h001"
msgstr ""
`,
    );

    const provider = createMockTranslateProvider({
      Hello: 'Translated Hello',
    });

    const result = await runTranslateAll({
      localeDir,
      defaultLocale: 'en',
      targetLocales: ['es', 'fr'],
      provider,
    });

    expect(result.results.size).toBe(2);
    expect(result.errors.size).toBe(0);

    expect(result.results.get('es')?.translated).toBe(1);
    expect(result.results.get('fr')?.translated).toBe(1);

    // Verify files were written
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    const frContent = await fs.readFile(join(localeDir, 'fr.po'), 'utf-8');
    expect(esContent).toContain('msgstr "Translated Hello"');
    expect(frContent).toContain('msgstr "Translated Hello"');
  });

  it('continues on error and reports all failures', async () => {
    // Create source locale
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );

    // Create only one target locale - 'ja' is missing
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""
`,
    );

    const provider = createMockTranslateProvider({
      Hello: 'Hola',
    });

    const result = await runTranslateAll({
      localeDir,
      defaultLocale: 'en',
      targetLocales: ['es', 'ja'], // 'ja' doesn't exist
      provider,
    });

    // Should have one success and one failure
    expect(result.results.size).toBe(1);
    expect(result.errors.size).toBe(1);

    expect(result.results.get('es')?.translated).toBe(1);
    expect(result.errors.has('ja')).toBe(true);

    // Verify the successful locale was still translated
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr "Hola"');
  });

  it('returns empty results when no target locales provided', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );

    const provider = createMockTranslateProvider({});

    const result = await runTranslateAll({
      localeDir,
      defaultLocale: 'en',
      targetLocales: [],
      provider,
    });

    expect(result.results.size).toBe(0);
    expect(result.errors.size).toBe(0);
  });

  it('passes through options like force and dryRun', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr "Old translation"
`,
    );

    const provider = createMockTranslateProvider({
      Hello: 'New translation',
    });

    const result = await runTranslateAll({
      localeDir,
      defaultLocale: 'en',
      targetLocales: ['es'],
      provider,
      force: true,
      dryRun: true,
    });

    expect(result.results.get('es')?.translated).toBe(1);
    expect(result.results.get('es')?.dryRun).toBe(true);

    // Verify file was NOT written (dry run)
    const esContent = await fs.readFile(join(localeDir, 'es.po'), 'utf-8');
    expect(esContent).toContain('msgstr "Old translation"');
  });

  it('calls onLocaleStart and onLocaleComplete callbacks', async () => {
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""
`,
    );

    const provider = createMockTranslateProvider({ Hello: 'Hola' });
    const onLocaleStart = vi.fn();
    const onLocaleComplete = vi.fn();

    await runTranslateAll({
      localeDir,
      defaultLocale: 'en',
      targetLocales: ['es'],
      provider,
      onLocaleStart,
      onLocaleComplete,
    });

    expect(onLocaleStart).toHaveBeenCalledWith('es');
    expect(onLocaleComplete).toHaveBeenCalledWith(
      'es',
      expect.objectContaining({
        translated: 1,
      }),
    );
  });
});
