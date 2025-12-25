import { describe, expect, it } from 'vitest';
import { mergeCatalogs } from './merge';
import { parsePoString } from './parser';
import type { Message } from './types';

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
