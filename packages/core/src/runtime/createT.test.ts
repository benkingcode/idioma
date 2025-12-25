import { describe, expect, it } from 'vitest';
import { createT } from './createT';

describe('createT', () => {
  describe('basic usage', () => {
    it('returns source text when no translations are inlined', () => {
      const t = createT('en');
      expect(t('Hello world')).toBe('Hello world');
    });

    it('returns source text for unknown locale', () => {
      const t = createT('fr');
      expect(t('Hello world')).toBe('Hello world');
    });
  });

  describe('with inlined translations (from Babel)', () => {
    it('returns translated text for matching locale', () => {
      const t = createT('es');
      // Simulates what Babel injects: t('source', { key: { locale: translation } })
      const result = t('Hello world', {
        abc123: { en: 'Hello world', es: 'Hola mundo' },
      });
      expect(result).toBe('Hola mundo');
    });

    it('falls back to source when locale not found in inlined translations', () => {
      const t = createT('fr');
      const result = t('Hello world', {
        abc123: { en: 'Hello world', es: 'Hola mundo' },
      });
      expect(result).toBe('Hello world');
    });

    it('uses first available locale as fallback when source not available', () => {
      const t = createT('de');
      const result = t('Hello world', {
        abc123: { es: 'Hola mundo', fr: 'Bonjour monde' },
      });
      // Falls back to first locale in the object
      expect(result).toBe('Hola mundo');
    });
  });

  describe('placeholder interpolation', () => {
    it('interpolates placeholders in source text', () => {
      const t = createT('en');
      const result = t('Hello {name}', { name: 'Ben' });
      expect(result).toBe('Hello Ben');
    });

    it('interpolates placeholders in translated text', () => {
      const t = createT('es');
      const result = t(
        'Hello {name}',
        { abc123: { en: 'Hello {name}', es: 'Hola {name}' } },
        { name: 'Ben' },
      );
      expect(result).toBe('Hola Ben');
    });

    it('handles multiple placeholders', () => {
      const t = createT('en');
      const result = t('Hello {firstName} {lastName}', {
        firstName: 'Ben',
        lastName: 'King',
      });
      expect(result).toBe('Hello Ben King');
    });

    it('leaves unknown placeholders unchanged', () => {
      const t = createT('en');
      const result = t('Hello {name}', {});
      expect(result).toBe('Hello {name}');
    });

    it('handles numeric values', () => {
      const t = createT('en');
      const result = t('You have {count} items', { count: 5 });
      expect(result).toBe('You have 5 items');
    });
  });

  describe('distinguishes values from inlined translations', () => {
    it('treats string values as interpolation values, not translations', () => {
      const t = createT('en');
      // When second arg has string values (not nested objects), it's interpolation values
      const result = t('Hello {name}', { name: 'Ben' });
      expect(result).toBe('Hello Ben');
    });

    it('treats nested objects as inlined translations', () => {
      const t = createT('es');
      // When second arg has object values, it's inlined translations from Babel
      const result = t('Hello', { abc123: { en: 'Hello', es: 'Hola' } });
      expect(result).toBe('Hola');
    });
  });
});
