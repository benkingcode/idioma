import { describe, expect, it } from 'vitest';
import { generateIdiomaMetadata } from './metadata.js';

describe('generateIdiomaMetadata', () => {
  describe('alternates generation', () => {
    it('generates hreflang links for all locales', () => {
      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com',
        locales: ['en', 'es', 'fr'],
        defaultLocale: 'en',
      });

      expect(result.alternates?.languages).toEqual({
        en: 'https://example.com/en/about',
        es: 'https://example.com/es/about',
        fr: 'https://example.com/fr/about',
        'x-default': 'https://example.com/en/about',
      });
    });

    it('uses localized paths when routes provided', () => {
      const routes = {
        en: { '/about': '/about' },
        es: { '/about': '/sobre' },
        fr: { '/about': '/a-propos' },
      };

      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com',
        locales: ['en', 'es', 'fr'],
        defaultLocale: 'en',
        routes,
      });

      expect(result.alternates?.languages).toEqual({
        en: 'https://example.com/en/about',
        es: 'https://example.com/es/sobre',
        fr: 'https://example.com/fr/a-propos',
        'x-default': 'https://example.com/en/about',
      });
    });

    it('handles as-needed prefix strategy for default locale', () => {
      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com',
        locales: ['en', 'es'],
        defaultLocale: 'en',
        prefixStrategy: 'as-needed',
      });

      expect(result.alternates?.languages).toEqual({
        en: 'https://example.com/about',
        es: 'https://example.com/es/about',
        'x-default': 'https://example.com/about',
      });
    });

    it('always adds prefix when strategy is always', () => {
      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com',
        locales: ['en', 'es'],
        defaultLocale: 'en',
        prefixStrategy: 'always',
      });

      expect(result.alternates?.languages).toEqual({
        en: 'https://example.com/en/about',
        es: 'https://example.com/es/about',
        'x-default': 'https://example.com/en/about',
      });
    });
  });

  describe('canonical URL', () => {
    it('sets canonical to current locale URL', () => {
      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com',
        locales: ['en', 'es'],
        defaultLocale: 'en',
        currentLocale: 'es',
      });

      expect(result.alternates?.canonical).toBe('https://example.com/es/about');
    });

    it('uses default locale for canonical when no currentLocale', () => {
      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com',
        locales: ['en', 'es'],
        defaultLocale: 'en',
        prefixStrategy: 'as-needed',
      });

      expect(result.alternates?.canonical).toBe('https://example.com/about');
    });
  });

  describe('x-default hreflang', () => {
    it('includes x-default pointing to default locale', () => {
      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com',
        locales: ['en', 'es'],
        defaultLocale: 'en',
        prefixStrategy: 'as-needed',
      });

      expect(result.alternates?.languages?.['x-default']).toBe(
        'https://example.com/about',
      );
    });
  });

  describe('edge cases', () => {
    it('handles root path', () => {
      const result = generateIdiomaMetadata({
        pathname: '/',
        baseUrl: 'https://example.com',
        locales: ['en', 'es'],
        defaultLocale: 'en',
      });

      expect(result.alternates?.languages).toEqual({
        en: 'https://example.com/en',
        es: 'https://example.com/es',
        'x-default': 'https://example.com/en',
      });
    });

    it('handles trailing slashes in baseUrl', () => {
      const result = generateIdiomaMetadata({
        pathname: '/about',
        baseUrl: 'https://example.com/',
        locales: ['en'],
        defaultLocale: 'en',
      });

      expect(result.alternates?.languages?.en).toBe(
        'https://example.com/en/about',
      );
    });
  });
});
