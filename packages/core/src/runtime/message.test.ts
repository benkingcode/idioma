import { describe, expect, it } from 'vitest';
import { _pickMessage } from './message';

describe('_pickMessage', () => {
  const messages = { en: 'Hello', es: 'Hola', 'zh-Hant': '你好' };

  it('picks the requested locale', () => {
    expect(_pickMessage(messages, 'es', 'en')).toBe('Hola');
  });

  it('falls back to the base locale: es-MX gets es', () => {
    expect(_pickMessage(messages, 'es-MX', 'en')).toBe('Hola');
  });

  it('accepts an underscore separator: es_MX gets es', () => {
    expect(_pickMessage(messages, 'es_MX', 'en')).toBe('Hola');
  });

  it('drops one subtag at a time: zh-Hant-TW gets zh-Hant', () => {
    expect(_pickMessage(messages, 'zh-Hant-TW', 'en')).toBe('你好');
  });

  it('falls back to the default locale', () => {
    expect(_pickMessage(messages, 'fr', 'en')).toBe('Hello');
  });

  it("never returns another locale's text (#8)", () => {
    // en (the default) has no text: the caller falls back to the source or
    // id, not to Spanish
    expect(_pickMessage({ es: 'Hola', ca: 'Hola!' }, 'en', 'en')).toBe(
      undefined,
    );
  });

  it('never returns another locale when the default is unknown', () => {
    expect(_pickMessage({ es: 'Hola' }, 'fr', undefined)).toBe(undefined);
  });

  it('never returns the __source fallback the transform adds', () => {
    expect(_pickMessage({ __source: 'Hello' }, 'fr', 'en')).toBe(undefined);
  });

  it('keeps an empty-string translation of the requested locale', () => {
    // The compiler omits empty msgstr, so a '' here was meant
    expect(_pickMessage({ en: 'Hello', es: '' }, 'es', 'en')).toBe('');
  });

  it('returns a compiled function as it is', () => {
    const plural = () => '2 items';
    expect(_pickMessage({ en: plural }, 'en', 'en')).toBe(plural);
  });

  it('handles a missing messages object', () => {
    expect(_pickMessage(undefined, 'en', 'en')).toBe(undefined);
  });
});
