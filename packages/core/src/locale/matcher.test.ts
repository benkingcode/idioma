import { describe, expect, it } from 'vitest';
import {
  isLocaleCompatible,
  matchLocale,
  parseAcceptLanguageHeader,
  type MatchLocaleOptions,
} from './matcher.js';

describe('parseAcceptLanguageHeader', () => {
  it('parses simple Accept-Language header', () => {
    const result = parseAcceptLanguageHeader('en-US,en;q=0.9,es;q=0.8');

    expect(result).toEqual(['en-US', 'en', 'es']);
  });

  it('sorts by quality factor', () => {
    const result = parseAcceptLanguageHeader('en;q=0.3,es;q=0.9,de;q=0.5');

    expect(result).toEqual(['es', 'de', 'en']);
  });

  it('handles spaces and whitespace', () => {
    const result = parseAcceptLanguageHeader('fr-CH, fr;q=0.9, en;q=0.8');

    expect(result).toEqual(['fr-CH', 'fr', 'en']);
  });

  it('handles wildcard (*)', () => {
    const result = parseAcceptLanguageHeader('en-US,*;q=0.5');

    expect(result).toEqual(['en-US', '*']);
  });

  it('returns empty array for null header', () => {
    expect(parseAcceptLanguageHeader(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseAcceptLanguageHeader('')).toEqual([]);
  });

  it('handles malformed headers gracefully', () => {
    const result = parseAcceptLanguageHeader('invalid,,;q=,');

    // Should not throw, should filter out invalid entries
    expect(Array.isArray(result)).toBe(true);
  });

  it('preserves full locale codes (does not strip region)', () => {
    const result = parseAcceptLanguageHeader('en-GB,en-US;q=0.9');

    expect(result).toEqual(['en-GB', 'en-US']);
  });
});

describe('matchLocale', () => {
  const defaultOptions: MatchLocaleOptions = {
    locales: ['en', 'es', 'de'],
    defaultLocale: 'en',
  };

  describe('basic matching', () => {
    it('matches exact locale', () => {
      const result = matchLocale('es', defaultOptions);

      expect(result).toBe('es');
    });

    it('returns defaultLocale for no match', () => {
      const result = matchLocale('ja', defaultOptions);

      expect(result).toBe('en');
    });

    it('returns defaultLocale for empty requested locales', () => {
      const result = matchLocale([], defaultOptions);

      expect(result).toBe('en');
    });
  });

  describe('Accept-Language header input', () => {
    it('accepts Accept-Language header string', () => {
      const result = matchLocale('es-ES,es;q=0.9,en;q=0.8', defaultOptions);

      expect(result).toBe('es');
    });

    it('respects quality factors', () => {
      const result = matchLocale('en;q=0.3,es;q=0.9,de;q=0.5', defaultOptions);

      expect(result).toBe('es');
    });
  });

  describe('language distance (best fit algorithm)', () => {
    it('matches en-GB to en-US via language distance', () => {
      const result = matchLocale('en-GB', {
        locales: ['en-US', 'es', 'de'],
        defaultLocale: 'de',
      });

      // en-GB should match en-US (same language family)
      expect(result).toBe('en-US');
    });

    it('matches zh-TW to zh-Hant via script', () => {
      const result = matchLocale('zh-TW', {
        locales: ['en', 'zh-Hans', 'zh-Hant'],
        defaultLocale: 'en',
      });

      // zh-TW (Traditional Chinese) should match zh-Hant
      expect(result).toBe('zh-Hant');
    });

    it('matches pt-BR to pt-PT via language distance', () => {
      const result = matchLocale('pt-BR', {
        locales: ['pt-PT', 'es', 'en'],
        defaultLocale: 'en',
      });

      // pt-BR should match pt-PT (same language family)
      expect(result).toBe('pt-PT');
    });

    it('matches sr-Latn to sr when only base available', () => {
      const result = matchLocale('sr-Latn', {
        locales: ['en', 'sr', 'de'],
        defaultLocale: 'en',
      });

      expect(result).toBe('sr');
    });
  });

  describe('lookup algorithm (strict matching)', () => {
    it('does not match en-GB to en-US with lookup', () => {
      const result = matchLocale('en-GB', {
        locales: ['en-US', 'de'],
        defaultLocale: 'de',
        algorithm: 'lookup',
      });

      // With lookup, en-GB won't match en-US (no language distance)
      // Falls back to default
      expect(result).toBe('de');
    });

    it('matches en-GB to en with lookup (parent match)', () => {
      const result = matchLocale('en-GB', {
        locales: ['en', 'de'],
        defaultLocale: 'de',
        algorithm: 'lookup',
      });

      // en-GB can match en (parent locale)
      expect(result).toBe('en');
    });
  });

  describe('array input', () => {
    it('accepts array of locales', () => {
      const result = matchLocale(['fr', 'de', 'en'], defaultOptions);

      expect(result).toBe('de'); // First match in available locales
    });

    it('respects priority order in array', () => {
      const result = matchLocale(['ja', 'zh', 'es'], defaultOptions);

      // ja and zh don't match, es does
      expect(result).toBe('es');
    });
  });

  describe('edge cases', () => {
    it('handles null input', () => {
      const result = matchLocale(null, defaultOptions);

      expect(result).toBe('en');
    });

    it('handles undefined input', () => {
      const result = matchLocale(undefined, defaultOptions);

      expect(result).toBe('en');
    });

    it('prefers exact match over language distance', () => {
      const result = matchLocale('en-GB', {
        locales: ['en-GB', 'en-US', 'en'],
        defaultLocale: 'en',
      });

      expect(result).toBe('en-GB');
    });
  });
});

describe('isLocaleCompatible', () => {
  it('returns true when exact match exists', () => {
    expect(isLocaleCompatible(['en', 'fr'], 'en')).toBe(true);
  });

  it('returns true when base language matches via best fit', () => {
    // User requests 'en', target is 'en-US' - should match via language distance
    expect(isLocaleCompatible(['en'], 'en-US')).toBe(true);
  });

  it('returns true when regional variant matches base', () => {
    // User requests 'en-GB', target is 'en' - should match
    expect(isLocaleCompatible(['en-GB'], 'en')).toBe(true);
  });

  it('returns true when regional variants match via distance', () => {
    // User requests 'en-GB', target is 'en-US' - should match via language distance
    expect(isLocaleCompatible(['en-GB'], 'en-US')).toBe(true);
  });

  it('returns false when no match', () => {
    expect(isLocaleCompatible(['de', 'fr'], 'en')).toBe(false);
  });

  it('returns false for empty requested locales', () => {
    expect(isLocaleCompatible([], 'en')).toBe(false);
  });

  it('handles Chinese variants correctly', () => {
    // zh-TW (Traditional Chinese) should match zh-Hant
    expect(isLocaleCompatible(['zh-TW'], 'zh-Hant')).toBe(true);
  });

  it('respects lookup algorithm (strict matching)', () => {
    // With lookup, en-GB should NOT match en-US (no language distance)
    expect(isLocaleCompatible(['en-GB'], 'en-US', 'lookup')).toBe(false);
    // But en-GB should still match en (parent)
    expect(isLocaleCompatible(['en-GB'], 'en', 'lookup')).toBe(true);
  });
});
