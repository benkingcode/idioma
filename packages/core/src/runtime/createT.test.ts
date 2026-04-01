import { describe, expect, it } from 'vitest';
import { generateKey } from '../keys/generator';
import { _createTFactory } from './createT';

describe('_createTFactory', () => {
  describe('basic usage', () => {
    it('returns source text when no translations are inlined', () => {
      const t = _createTFactory('en');
      expect(t('Hello world')).toBe('Hello world');
    });

    it('returns source text for unknown locale', () => {
      const t = _createTFactory('fr');
      expect(t('Hello world')).toBe('Hello world');
    });
  });

  describe('with inlined translations (from Babel)', () => {
    it('returns translated text for matching locale', () => {
      const t = _createTFactory('es');
      // Simulates what Babel injects: t('source', { __m: { locale: translation } })
      const result = t('Hello world', {
        __m: { en: 'Hello world', es: 'Hola mundo' },
      });
      expect(result).toBe('Hola mundo');
    });

    it('falls back to source when locale not found in inlined translations', () => {
      const t = _createTFactory('fr');
      const result = t('Hello world', {
        __m: { en: 'Hello world', es: 'Hola mundo' },
      });
      expect(result).toBe('Hello world');
    });

    it('uses first available locale as fallback when source not available', () => {
      const t = _createTFactory('de');
      const result = t('Hello world', {
        __m: { es: 'Hola mundo', fr: 'Bonjour monde' },
      });
      // Falls back to first locale in the object
      expect(result).toBe('Hola mundo');
    });
  });

  describe('placeholder interpolation', () => {
    it('interpolates placeholders in source text', () => {
      const t = _createTFactory('en');
      const result = t('Hello {name}', { name: 'Ben' });
      expect(result).toBe('Hello Ben');
    });

    it('interpolates placeholders in translated text', () => {
      const t = _createTFactory('es');
      const result = t(
        'Hello {name}',
        { __m: { en: 'Hello {name}', es: 'Hola {name}' } },
        { name: 'Ben' },
      );
      expect(result).toBe('Hola Ben');
    });

    it('handles multiple placeholders', () => {
      const t = _createTFactory('en');
      const result = t('Hello {firstName} {lastName}', {
        firstName: 'Ben',
        lastName: 'King',
      });
      expect(result).toBe('Hello Ben King');
    });

    it('leaves unknown placeholders unchanged', () => {
      const t = _createTFactory('en');
      const result = t('Hello {name}', {});
      expect(result).toBe('Hello {name}');
    });

    it('handles numeric values', () => {
      const t = _createTFactory('en');
      const result = t('You have {count} items', { count: 5 });
      expect(result).toBe('You have 5 items');
    });
  });

  describe('distinguishes values from inlined translations', () => {
    it('treats string values as interpolation values, not translations', () => {
      const t = _createTFactory('en');
      // When second arg has string values (not nested objects), it's interpolation values
      const result = t('Hello {name}', { name: 'Ben' });
      expect(result).toBe('Hello Ben');
    });

    it('treats __m marker as inlined translations', () => {
      const t = _createTFactory('es');
      // When second arg has __m marker, it's inlined translations from Babel
      const result = t('Hello', { __m: { en: 'Hello', es: 'Hola' } });
      expect(result).toBe('Hola');
    });

    it('does not false-positive on nested objects without __m marker', () => {
      const t = _createTFactory('en');
      // Nested object values without __m should be treated as interpolation values
      const result = t('Data: {info}', { info: { en: 'value' } } as Record<
        string,
        unknown
      >);
      expect(result).toBe('Data: [object Object]');
    });
  });

  describe('dynamic string lookup (with translations object)', () => {
    // Build a translations object like what the compiler generates
    const translations = {
      [generateKey('Hello world')]: { en: 'Hello world', es: 'Hola mundo' },
      [generateKey('Hello {name}')]: { en: 'Hello {name}', es: 'Hola {name}' },
      [generateKey('Goodbye')]: { en: 'Goodbye', es: 'Adiós' },
    };

    it('looks up dynamic strings by hashing the source', () => {
      const t = _createTFactory('es', translations);
      // Dynamic string - no Babel inlining, runtime does the lookup
      expect(t('Hello world')).toBe('Hola mundo');
    });

    it('falls back to source when key not found in translations', () => {
      const t = _createTFactory('es', translations);
      expect(t('Unknown string')).toBe('Unknown string');
    });

    it('interpolates placeholders in looked-up translations', () => {
      const t = _createTFactory('es', translations);
      expect(t('Hello {name}', { name: 'Ben' })).toBe('Hola Ben');
    });

    it('prefers Babel-inlined translations over runtime lookup', () => {
      const t = _createTFactory('es', translations);
      // When Babel inlines translations, those take precedence
      const result = t('Hello world', {
        __m: {
          en: 'Hello world',
          es: 'Babel-inlined',
        },
      });
      expect(result).toBe('Babel-inlined');
    });

    it('handles translations object being undefined', () => {
      const t = _createTFactory('es', undefined);
      expect(t('Hello world')).toBe('Hello world');
    });
  });

  describe('object form fallback (Babel not configured)', () => {
    it('returns id when no source provided', () => {
      const t = _createTFactory('en');
      const result = t({ id: 'greeting' });
      expect(result).toBe('greeting');
    });

    it('returns source when provided', () => {
      const t = _createTFactory('en');
      const result = t({
        id: 'greeting',
        source: 'Hello!',
      });
      expect(result).toBe('Hello!');
    });

    it('interpolates values into source fallback', () => {
      const t = _createTFactory('en');
      const result = t({
        id: 'greeting',
        source: 'Hello {name}!',
        values: { name: 'Ben' },
      });
      expect(result).toBe('Hello Ben!');
    });
  });
});
