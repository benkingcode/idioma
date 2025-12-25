import { describe, expect, it } from 'vitest';
import { createServerT } from './createServerT';
import { generateKey } from './generateKey';

describe('createServerT', () => {
  // Sample translations keyed by hash
  const translations = {
    // 'Hello world!' hashed
    [generateKey('Hello world!')]: {
      en: 'Hello world!',
      es: 'Hola mundo!',
    },
    // 'Hello {name}' hashed
    [generateKey('Hello {name}')]: {
      en: 'Hello {name}',
      es: 'Hola {name}',
    },
    // 'Submit' with context 'button' hashed
    [generateKey('Submit', 'button')]: {
      en: 'Submit',
      es: 'Enviar',
    },
    // Key-only translations (manual id)
    welcome: {
      en: 'Welcome!',
      es: 'Bienvenido!',
    },
    greeting: {
      en: 'Hello {name}!',
      es: 'Hola {name}!',
    },
    // Plural function
    'items.count': {
      en: (args: { count: number }) =>
        args.count === 1 ? '1 item' : `${args.count} items`,
      es: (args: { count: number }) =>
        args.count === 1 ? '1 artículo' : `${args.count} artículos`,
    },
  };

  describe('source text mode', () => {
    it('translates source text for given locale', async () => {
      const t = createServerT('es', translations);
      const result = await t('Hello world!');
      expect(result).toBe('Hola mundo!');
    });

    it('returns source text if translation not found', async () => {
      const t = createServerT('en', translations);
      const result = await t('Unknown message');
      expect(result).toBe('Unknown message');
    });

    it('interpolates values', async () => {
      const t = createServerT('es', translations);
      const result = await t('Hello {name}', { name: 'Ben' });
      expect(result).toBe('Hola Ben');
    });

    it('interpolates values in source when translation not found', async () => {
      const t = createServerT('en', translations);
      const result = await t('Hi {name}!', { name: 'Ben' });
      expect(result).toBe('Hi Ben!');
    });
  });

  describe('with context (3rd arg)', () => {
    it('uses context to generate different key', async () => {
      const t = createServerT('es', translations);
      const result = await t('Submit', undefined, { context: 'button' });
      expect(result).toBe('Enviar');
    });

    it('accepts empty object for values when only options needed', async () => {
      const t = createServerT('es', translations);
      const result = await t('Submit', {}, { context: 'button' });
      expect(result).toBe('Enviar');
    });

    it('context without translation falls back to source', async () => {
      const t = createServerT('en', translations);
      const result = await t('Submit', undefined, { context: 'unknown' });
      expect(result).toBe('Submit');
    });

    it('accepts values and options together', async () => {
      const t = createServerT('es', translations);
      // No translation for 'greeting' context, should fall back to interpolated source
      const result = await t(
        'Hello {name}',
        { name: 'Ben' },
        { context: 'greeting' },
      );
      expect(result).toBe('Hello Ben');
    });
  });

  describe('key-only mode', () => {
    it('looks up by explicit id', async () => {
      const t = createServerT('es', translations);
      const result = await t({ id: 'welcome' });
      expect(result).toBe('Bienvenido!');
    });

    it('returns id if not found', async () => {
      const t = createServerT('en', translations);
      const result = await t({ id: 'nonexistent' });
      expect(result).toBe('nonexistent');
    });

    it('interpolates values with id lookup', async () => {
      const t = createServerT('es', translations);
      const result = await t({ id: 'greeting', values: { name: 'Ben' } });
      expect(result).toBe('Hola Ben!');
    });

    it('handles function messages (plurals)', async () => {
      const t = createServerT('en', translations);
      expect(await t({ id: 'items.count', values: { count: 1 } })).toBe(
        '1 item',
      );
      expect(await t({ id: 'items.count', values: { count: 5 } })).toBe(
        '5 items',
      );
    });
  });

  describe('locale fallback', () => {
    it('falls back to first available locale if requested not found', async () => {
      const t = createServerT('fr', translations); // French not in translations
      const result = await t('Hello world!');
      expect(result).toBe('Hello world!'); // Falls back to 'en' (first)
    });
  });
});
