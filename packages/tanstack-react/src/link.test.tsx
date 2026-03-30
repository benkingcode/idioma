import { describe, expect, it } from 'vitest';
import { resolveLocalizedHref, resolveLocalizedPath } from './link.js';

describe('resolveLocalizedPath', () => {
  it('returns original path without routes', () => {
    expect(resolveLocalizedPath('/about', 'en')).toBe('/about');
    expect(resolveLocalizedPath('/about', 'es')).toBe('/about');
  });

  it('translates path with routes', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
    };

    expect(resolveLocalizedPath('/about', 'en', routes)).toBe('/about');
    expect(resolveLocalizedPath('/about', 'es', routes)).toBe('/sobre');
  });

  it('falls back to original path when no translation', () => {
    const routes = {
      en: { '/about': '/about' },
      es: {},
    };

    expect(resolveLocalizedPath('/contact', 'es', routes)).toBe('/contact');
  });
});

describe('resolveLocalizedHref', () => {
  const routes = {
    en: { '/about': '/about', '/blog': '/blog' },
    es: { '/about': '/sobre', '/blog': '/articulos' },
    fr: { '/about': '/a-propos', '/blog': '/articles' },
  };

  describe('prefixStrategy: always', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'always' as const,
    };

    it('adds prefix for default locale', () => {
      expect(resolveLocalizedHref('/about', 'en', config)).toBe('/en/about');
    });

    it('adds prefix for non-default locale', () => {
      expect(resolveLocalizedHref('/about', 'es', config)).toBe('/es/sobre');
    });

    it('translates path segments', () => {
      expect(resolveLocalizedHref('/blog', 'fr', config)).toBe('/fr/articles');
    });
  });

  describe('prefixStrategy: as-needed', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'as-needed' as const,
    };

    it('does NOT add prefix for default locale', () => {
      expect(resolveLocalizedHref('/about', 'en', config)).toBe('/about');
    });

    it('adds prefix for non-default locale', () => {
      expect(resolveLocalizedHref('/about', 'es', config)).toBe('/es/sobre');
    });

    it('still translates path for default locale', () => {
      // Default locale doesn't translate, but if it had different paths...
      expect(resolveLocalizedHref('/blog', 'en', config)).toBe('/blog');
    });
  });

  describe('prefixStrategy: never', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'never' as const,
    };

    it('never adds prefix for default locale', () => {
      expect(resolveLocalizedHref('/about', 'en', config)).toBe('/about');
    });

    it('never adds prefix for non-default locale', () => {
      expect(resolveLocalizedHref('/about', 'es', config)).toBe('/sobre');
    });

    it('still translates path segments', () => {
      expect(resolveLocalizedHref('/blog', 'fr', config)).toBe('/articles');
    });
  });

  it('falls back to original path when no translation', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'as-needed' as const,
    };
    expect(resolveLocalizedHref('/contact', 'es', config)).toBe('/es/contact');
  });
});
