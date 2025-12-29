import { describe, expect, it } from 'vitest';
import { getLocaleHead } from './getLocaleHead';

describe('getLocaleHead', () => {
  const baseOptions = {
    pathname: '/about',
    locale: 'en',
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
  };

  describe('basic functionality', () => {
    it('generates hreflang links for all locales', () => {
      const result = getLocaleHead(baseOptions);

      expect(result.links).toHaveLength(4); // 3 locales + x-default
      expect(result.links).toContainEqual({
        hreflang: 'en',
        href: '/en/about',
      });
      expect(result.links).toContainEqual({
        hreflang: 'es',
        href: '/es/about',
      });
      expect(result.links).toContainEqual({
        hreflang: 'fr',
        href: '/fr/about',
      });
    });

    it('includes x-default pointing to default locale', () => {
      const result = getLocaleHead(baseOptions);

      const xDefault = result.links.find((l) => l.hreflang === 'x-default');
      expect(xDefault).toEqual({ hreflang: 'x-default', href: '/en/about' });
    });

    it('returns canonical URL for current locale', () => {
      const result = getLocaleHead({ ...baseOptions, locale: 'es' });

      expect(result.canonical).toBe('/es/about');
    });
  });

  describe('metadataBase handling', () => {
    it('prepends metadataBase to all URLs when provided', () => {
      const result = getLocaleHead({
        ...baseOptions,
        metadataBase: 'https://example.com',
      });

      expect(result.canonical).toBe('https://example.com/en/about');
      expect(result.links[0].href).toMatch(/^https:\/\/example\.com/);
    });

    it('removes trailing slash from metadataBase', () => {
      const result = getLocaleHead({
        ...baseOptions,
        metadataBase: 'https://example.com/',
      });

      expect(result.canonical).toBe('https://example.com/en/about');
    });

    it('works with empty metadataBase (relative URLs)', () => {
      const result = getLocaleHead({
        ...baseOptions,
        metadataBase: '',
      });

      expect(result.canonical).toBe('/en/about');
    });
  });

  describe('prefixStrategy', () => {
    it('always prefixes all locales by default', () => {
      const result = getLocaleHead(baseOptions);

      expect(result.links.find((l) => l.hreflang === 'en')?.href).toBe(
        '/en/about',
      );
    });

    it('skips prefix for default locale with as-needed strategy', () => {
      const result = getLocaleHead({
        ...baseOptions,
        prefixStrategy: 'as-needed',
      });

      expect(result.links.find((l) => l.hreflang === 'en')?.href).toBe(
        '/about',
      );
      expect(result.links.find((l) => l.hreflang === 'es')?.href).toBe(
        '/es/about',
      );
    });
  });

  describe('route translations', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
      fr: { '/about': '/a-propos' },
    };

    it('uses translated paths from routes map', () => {
      const result = getLocaleHead({
        ...baseOptions,
        routes,
      });

      expect(result.links.find((l) => l.hreflang === 'es')?.href).toBe(
        '/es/sobre',
      );
      expect(result.links.find((l) => l.hreflang === 'fr')?.href).toBe(
        '/fr/a-propos',
      );
    });

    it('falls back to original path if no translation exists', () => {
      const result = getLocaleHead({
        ...baseOptions,
        pathname: '/contact',
        routes,
      });

      expect(result.links.find((l) => l.hreflang === 'es')?.href).toBe(
        '/es/contact',
      );
    });
  });

  describe('root path handling', () => {
    it('handles root path without double slashes', () => {
      const result = getLocaleHead({
        ...baseOptions,
        pathname: '/',
      });

      expect(result.links.find((l) => l.hreflang === 'en')?.href).toBe('/en');
      expect(result.links.find((l) => l.hreflang === 'es')?.href).toBe('/es');
    });

    it('handles root path with as-needed strategy', () => {
      const result = getLocaleHead({
        ...baseOptions,
        pathname: '/',
        prefixStrategy: 'as-needed',
      });

      expect(result.links.find((l) => l.hreflang === 'en')?.href).toBe('/');
      expect(result.links.find((l) => l.hreflang === 'es')?.href).toBe('/es');
    });
  });

  describe('edge cases', () => {
    it('handles unknown locale gracefully', () => {
      const result = getLocaleHead({
        ...baseOptions,
        locale: 'de', // not in locales array
      });

      // Should still return links for all configured locales
      expect(result.links).toHaveLength(4);
      // Canonical falls back to default locale
      expect(result.canonical).toBe('/en/about');
    });

    it('handles empty locales array', () => {
      const result = getLocaleHead({
        ...baseOptions,
        locales: [],
      });

      expect(result.links).toHaveLength(0);
      expect(result.canonical).toBe('');
    });
  });
});
