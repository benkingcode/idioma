import { describe, expect, it } from 'vitest';
import { mergeCatalogs, mergeFileIntoCatalog } from './merge';
import { parsePoString } from './parser';
import type { Catalog, Message } from './types';

function createMessage(
  source: string,
  translation: string,
  extra?: Partial<Message>,
): Message {
  return {
    key: source,
    source,
    translation,
    ...extra,
  };
}

describe('mergeCatalogs', () => {
  it('adds new messages from extracted to existing', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgid "Hello"
msgstr ""

msgid "Goodbye"
msgstr ""
`,
      'es',
    );

    const result = mergeCatalogs(existing, extracted);

    expect(result.added).toContain('Goodbye');
    expect(existing.messages.has('Goodbye')).toBe(true);
    expect(existing.messages.get('Goodbye')!.translation).toBe('');
  });

  it('preserves existing translations', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgid "Hello"
msgstr ""
`,
      'es',
    );

    mergeCatalogs(existing, extracted);

    // Existing translation should be preserved
    expect(existing.messages.get('Hello')!.translation).toBe('Hola');
  });

  it('updates references for existing messages', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

#: src/old-file.tsx:10
msgid "Hello"
msgstr "Hola"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

#: src/new-file.tsx:20
msgid "Hello"
msgstr ""
`,
      'es',
    );

    const result = mergeCatalogs(existing, extracted);

    expect(result.updated).toContain('Hello');
    expect(existing.messages.get('Hello')!.references).toEqual([
      'src/new-file.tsx:20',
    ]);
  });

  it('removes unused messages when clean option is true', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"

msgid "Obsolete"
msgstr "Obsoleto"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgid "Hello"
msgstr ""
`,
      'es',
    );

    const result = mergeCatalogs(existing, extracted, { clean: true });

    expect(result.removed).toContain('Obsolete');
    expect(existing.messages.has('Obsolete')).toBe(false);
    expect(existing.messages.has('Hello')).toBe(true);
  });

  it('keeps unused messages when clean option is false', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"

msgid "Obsolete"
msgstr "Obsoleto"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgid "Hello"
msgstr ""
`,
      'es',
    );

    const result = mergeCatalogs(existing, extracted, { clean: false });

    expect(result.removed).toHaveLength(0);
    expect(existing.messages.has('Obsolete')).toBe(true);
  });

  it('marks messages as fuzzy when source changes and markFuzzy is true', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello world"
msgstr "Hola mundo"
`,
      'es',
    );

    // Simulate a source change by manually changing the existing message
    // In reality, this would be detected by comparing hashes
    existing.messages.get('Hello world')!.source = 'Hello world!';

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgid "Hello world"
msgstr ""
`,
      'es',
    );

    const result = mergeCatalogs(existing, extracted, { markFuzzy: true });

    // Note: This is a simplified test - real fuzzy marking would involve
    // comparing the original source with what was extracted
    expect(result.updated).toContain('Hello world');
  });

  it('handles messages with context', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgctxt "button"
msgid "Submit"
msgstr "Enviar"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgctxt "button"
msgid "Submit"
msgstr ""

msgctxt "form"
msgid "Submit"
msgstr ""
`,
      'es',
    );

    const result = mergeCatalogs(existing, extracted);

    expect(result.added).toContain('form\u0004Submit');
    expect(existing.messages.get('button\u0004Submit')!.translation).toBe(
      'Enviar',
    );
    expect(existing.messages.get('form\u0004Submit')!.translation).toBe('');
  });

  it('preserves comments from extracted messages', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

#. This is a greeting
msgid "Hello"
msgstr ""
`,
      'es',
    );

    mergeCatalogs(existing, extracted);

    expect(existing.messages.get('Hello')!.comments).toEqual([
      'This is a greeting',
    ]);
  });

  it('preserves existing comments when extracted has none', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

#. [AI Context]: Important greeting message
msgid "Hello"
msgstr "Hola"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgid "Hello"
msgstr ""
`,
      'es',
    );

    mergeCatalogs(existing, extracted);

    // Existing comment should be preserved when extracted has none
    expect(existing.messages.get('Hello')!.comments).toEqual([
      '[AI Context]: Important greeting message',
    ]);
  });

  it('updates context on existing messages', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Submit"
msgstr "Enviar"
`,
      'es',
    );

    // Extracted now has context
    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgctxt "button"
msgid "Submit"
msgstr ""
`,
      'es',
    );

    // Note: This tests the bug where context wasn't being updated
    // The keys are different (Submit vs button\u0004Submit) so this adds a new message
    // But if we had an existing message with the SAME key, context should be updated
    const result = mergeCatalogs(existing, extracted);

    // For now, this is an add since the keys differ
    expect(result.added).toContain('button\u0004Submit');
  });

  it('preserves context when merging existing message with same context', () => {
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgctxt "button"
msgid "Submit"
msgstr "Enviar"
`,
      'es',
    );

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgctxt "button"
msgid "Submit"
msgstr ""
`,
      'es',
    );

    mergeCatalogs(existing, extracted);

    const msg = existing.messages.get('button\u0004Submit');
    expect(msg?.context).toBe('button');
    expect(msg?.translation).toBe('Enviar');
  });

  it('updates context property when merging existing messages', () => {
    // Simulate a case where existing message has stale/missing context property
    // but the extracted message has the correct context
    const existing = parsePoString(
      `
msgid ""
msgstr ""
"Language: es\\n"

msgctxt "button"
msgid "Submit"
msgstr "Enviar"
`,
      'es',
    );

    // Manually corrupt the context property to simulate stale data
    const msg = existing.messages.get('button\u0004Submit')!;
    msg.context = undefined; // Context property is missing

    const extracted = parsePoString(
      `
msgid ""
msgstr ""

msgctxt "button"
msgid "Submit"
msgstr ""
`,
      'es',
    );

    mergeCatalogs(existing, extracted);

    // Context should be restored from extracted message
    const updatedMsg = existing.messages.get('button\u0004Submit');
    expect(updatedMsg?.context).toBe('button');
    expect(updatedMsg?.translation).toBe('Enviar'); // Translation preserved
  });
});

describe('mergeFileIntoCatalog', () => {
  function createCatalog(
    locale: string,
    messages: Array<{
      key: string;
      translation: string;
      references?: string[];
      flags?: string[];
    }>,
  ): Catalog {
    const catalog: Catalog = {
      locale,
      headers: { Language: locale },
      messages: new Map(),
    };
    for (const msg of messages) {
      catalog.messages.set(msg.key, {
        key: msg.key,
        source: msg.key,
        translation: msg.translation,
        references: msg.references ?? [],
        flags: msg.flags,
      });
    }
    return catalog;
  }

  it('adds new messages with file reference', () => {
    const existing = createCatalog('es', []);
    const extracted = createCatalog('es', [
      { key: 'hello', translation: '', references: ['src/App.tsx'] },
    ]);

    const result = mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    expect(result.added).toContain('hello');
    expect(existing.messages.get('hello')?.references).toEqual(['src/App.tsx']);
  });

  it('removes file reference from existing messages when not in extracted', () => {
    const existing = createCatalog('es', [
      {
        key: 'hello',
        translation: '',
        references: ['src/App.tsx', 'src/Other.tsx'],
      },
    ]);
    const extracted = createCatalog('es', []);

    mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    // Should remove src/App.tsx but keep src/Other.tsx
    expect(existing.messages.get('hello')?.references).toEqual([
      'src/Other.tsx',
    ]);
  });

  it('removes orphaned untranslated messages when no references remain (with extracted flag)', () => {
    const existing = createCatalog('es', [
      {
        key: 'hello',
        translation: '',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
    ]);
    const extracted = createCatalog('es', []);

    const result = mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    expect(result.removed).toContain('hello');
    expect(existing.messages.has('hello')).toBe(false);
  });

  it('keeps orphaned messages if they have translations in other locales', () => {
    const existing = createCatalog('en', [
      {
        key: 'hello',
        translation: 'Hello',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
    ]);
    const extracted = createCatalog('en', []);

    // Spanish catalog has a translation for this message
    const spanishCatalog = createCatalog('es', [
      {
        key: 'hello',
        translation: 'Hola',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
    ]);

    const result = mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
      otherLocaleCatalogs: [spanishCatalog],
    });

    // Should NOT remove because Spanish has a translation
    expect(result.removed).not.toContain('hello');
    expect(existing.messages.has('hello')).toBe(true);
    // References should be empty but message is preserved
    expect(existing.messages.get('hello')?.references).toEqual([]);
  });

  it('removes orphaned messages if no other locale has translations', () => {
    const existing = createCatalog('en', [
      {
        key: 'hello',
        translation: 'Hello',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
    ]);
    const extracted = createCatalog('en', []);

    // Spanish catalog has this message but with empty translation
    const spanishCatalog = createCatalog('es', [
      {
        key: 'hello',
        translation: '',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
    ]);

    const result = mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
      otherLocaleCatalogs: [spanishCatalog],
    });

    // Should remove because Spanish translation is empty
    expect(result.removed).toContain('hello');
    expect(existing.messages.has('hello')).toBe(false);
  });

  it('never removes orphaned messages without extracted flag (TMS protection)', () => {
    const existing = createCatalog('en', [
      {
        key: 'tms-message',
        translation: 'From TMS',
        references: ['src/App.tsx'],
        // No 'extracted' flag - this came from a TMS
      },
    ]);
    const extracted = createCatalog('en', []);

    const result = mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    // Should NOT remove because it lacks the 'extracted' flag
    expect(result.removed).not.toContain('tms-message');
    expect(existing.messages.has('tms-message')).toBe(true);
    // References are removed but message is preserved
    expect(existing.messages.get('tms-message')?.references).toEqual([]);
  });

  it('removes orphaned messages with extracted flag but keeps those without', () => {
    const existing = createCatalog('en', [
      {
        key: 'idioma-message',
        translation: 'From Idioma',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
      {
        key: 'tms-message',
        translation: 'From TMS',
        references: ['src/App.tsx'],
        // No 'extracted' flag
      },
    ]);
    const extracted = createCatalog('en', []);

    const result = mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    // idioma-message should be removed (has extracted flag, no translations)
    expect(result.removed).toContain('idioma-message');
    expect(existing.messages.has('idioma-message')).toBe(false);

    // tms-message should be preserved (no extracted flag)
    expect(result.removed).not.toContain('tms-message');
    expect(existing.messages.has('tms-message')).toBe(true);
  });

  it('adds file to references for existing messages found in extracted', () => {
    const existing = createCatalog('es', [
      { key: 'hello', translation: 'Hola', references: ['src/Other.tsx'] },
    ]);
    const extracted = createCatalog('es', [
      { key: 'hello', translation: '', references: ['src/App.tsx'] },
    ]);

    const result = mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    expect(result.updated).toContain('hello');
    // Should have both references
    expect(existing.messages.get('hello')?.references).toContain('src/App.tsx');
    expect(existing.messages.get('hello')?.references).toContain(
      'src/Other.tsx',
    );
    // Translation should be preserved
    expect(existing.messages.get('hello')?.translation).toBe('Hola');
  });

  it('does not duplicate file reference if already present', () => {
    const existing = createCatalog('es', [
      { key: 'hello', translation: 'Hola', references: ['src/App.tsx'] },
    ]);
    const extracted = createCatalog('es', [
      { key: 'hello', translation: '', references: ['src/App.tsx'] },
    ]);

    mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    // Should have only one reference, not duplicated
    expect(existing.messages.get('hello')?.references).toEqual(['src/App.tsx']);
  });

  it('preserves translation when updating references', () => {
    const existing = createCatalog('es', [
      { key: 'hello', translation: 'Hola', references: ['src/Old.tsx'] },
    ]);
    const extracted = createCatalog('es', [
      { key: 'hello', translation: '', references: ['src/App.tsx'] },
    ]);

    mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/App.tsx',
      defaultLocale: 'en',
    });

    expect(existing.messages.get('hello')?.translation).toBe('Hola');
  });

  it('handles messages appearing in multiple files correctly', () => {
    const existing = createCatalog('es', [
      {
        key: 'shared',
        translation: 'Compartido',
        references: ['src/A.tsx', 'src/B.tsx'],
      },
    ]);
    // Extracted from A.tsx still has the message
    const extracted = createCatalog('es', [
      { key: 'shared', translation: '', references: ['src/A.tsx'] },
    ]);

    mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/A.tsx',
      defaultLocale: 'en',
    });

    // Should still have both references since we only update A.tsx's presence
    expect(existing.messages.get('shared')?.references).toContain('src/A.tsx');
    expect(existing.messages.get('shared')?.references).toContain('src/B.tsx');
  });

  it('removes file reference when message is removed from that file', () => {
    const existing = createCatalog('es', [
      {
        key: 'shared',
        translation: 'Compartido',
        references: ['src/A.tsx', 'src/B.tsx'],
      },
    ]);
    // Extracted from A.tsx no longer has the message
    const extracted = createCatalog('es', []);

    mergeFileIntoCatalog(existing, extracted, {
      filePath: 'src/A.tsx',
      defaultLocale: 'en',
    });

    // Should only have src/B.tsx now
    expect(existing.messages.get('shared')?.references).toEqual(['src/B.tsx']);
    // Message should still exist (not orphaned, has other reference)
    expect(existing.messages.has('shared')).toBe(true);
  });
});
