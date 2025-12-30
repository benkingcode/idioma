/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLocaleLoader,
  createPrefixOnlyRewriter,
  createUrlRewriter,
} from './spa';

// Mock @tanstack/react-router's redirect
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: { to: string }) => {
    const error = new Error('REDIRECT') as Error & { to: string };
    error.to = opts.to;
    throw error;
  }),
}));

describe('createLocaleLoader', () => {
  const baseConfig = {
    locales: ['en', 'es'] as const,
    defaultLocale: 'en' as const,
    prefixStrategy: 'as-needed' as const,
    detection: {
      order: ['cookie', 'header'] as const,
      cookieName: 'IDIOMA_LOCALE',
    },
  };

  beforeEach(() => {
    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  describe('localeLoader', () => {
    it('returns locale from path when present', () => {
      const { localeLoader } = createLocaleLoader(baseConfig);

      const result = localeLoader({
        location: { pathname: '/es/about', searchStr: '', hash: '' },
      });

      expect(result.locale).toBe('es');
    });

    it('detects locale from cookie when no path locale', () => {
      document.cookie = 'IDIOMA_LOCALE=es';
      const { localeLoader } = createLocaleLoader(baseConfig);

      // With as-needed strategy, non-default locale should redirect
      expect(() =>
        localeLoader({
          location: { pathname: '/about', searchStr: '', hash: '' },
        }),
      ).toThrow('REDIRECT');
    });

    it('returns default locale when no path locale and cookie matches default', () => {
      document.cookie = 'IDIOMA_LOCALE=en';
      const { localeLoader } = createLocaleLoader(baseConfig);

      const result = localeLoader({
        location: { pathname: '/about', searchStr: '', hash: '' },
      });

      expect(result.locale).toBe('en');
    });

    it('throws redirect when as-needed and default locale in path', () => {
      const { localeLoader } = createLocaleLoader(baseConfig);

      try {
        localeLoader({
          location: { pathname: '/en/about', searchStr: '', hash: '' },
        });
        expect.fail('Should have thrown redirect');
      } catch (error) {
        expect((error as Error & { to: string }).to).toBe('/about');
      }
    });

    it('throws redirect with query and hash preserved', () => {
      const { localeLoader } = createLocaleLoader(baseConfig);

      try {
        localeLoader({
          location: {
            pathname: '/en/about',
            searchStr: '?foo=bar',
            hash: '#section',
          },
        });
        expect.fail('Should have thrown redirect');
      } catch (error) {
        expect((error as Error & { to: string }).to).toBe(
          '/about?foo=bar#section',
        );
      }
    });

    it('does not redirect non-default locale in path with as-needed strategy', () => {
      const { localeLoader } = createLocaleLoader(baseConfig);

      const result = localeLoader({
        location: { pathname: '/es/about', searchStr: '', hash: '' },
      });

      expect(result.locale).toBe('es');
    });

    it('returns locale from path with never strategy', () => {
      const { localeLoader } = createLocaleLoader({
        ...baseConfig,
        prefixStrategy: 'never',
      });

      const result = localeLoader({
        location: { pathname: '/es/about', searchStr: '', hash: '' },
      });

      expect(result.locale).toBe('es');
    });

    it('detects and returns locale with never strategy (no redirect)', () => {
      document.cookie = 'IDIOMA_LOCALE=es';
      const { localeLoader } = createLocaleLoader({
        ...baseConfig,
        prefixStrategy: 'never',
      });

      const result = localeLoader({
        location: { pathname: '/about', searchStr: '', hash: '' },
      });

      expect(result.locale).toBe('es');
    });

    it('redirects with always strategy when no locale in path', () => {
      document.cookie = 'IDIOMA_LOCALE=en';
      const { localeLoader } = createLocaleLoader({
        ...baseConfig,
        prefixStrategy: 'always',
      });

      try {
        localeLoader({
          location: { pathname: '/about', searchStr: '', hash: '' },
        });
        expect.fail('Should have thrown redirect');
      } catch (error) {
        expect((error as Error & { to: string }).to).toBe('/en/about');
      }
    });
  });

  describe('detectClientLocale', () => {
    it('returns default locale when no cookie or navigator', () => {
      const { detectClientLocale } = createLocaleLoader(baseConfig);
      expect(detectClientLocale()).toBe('en');
    });

    it('returns locale from cookie', () => {
      document.cookie = 'IDIOMA_LOCALE=es';
      const { detectClientLocale } = createLocaleLoader(baseConfig);
      expect(detectClientLocale()).toBe('es');
    });

    it('ignores invalid locale in cookie', () => {
      document.cookie = 'IDIOMA_LOCALE=fr';
      const { detectClientLocale } = createLocaleLoader(baseConfig);
      expect(detectClientLocale()).toBe('en');
    });
  });
});

describe('createUrlRewriter', () => {
  const routePatterns = [
    {
      canonical: ['about'] as const,
      localized: { en: ['about'] as const, es: ['sobre'] as const },
    },
    {
      canonical: ['blog', '$slug'] as const,
      localized: {
        en: ['blog', '$slug'] as const,
        es: ['articulos', '$slug'] as const,
      },
    },
    {
      canonical: ['users', '$userId', 'posts'] as const,
      localized: {
        en: ['users', '$userId', 'posts'] as const,
        es: ['usuarios', '$userId', 'publicaciones'] as const,
      },
    },
  ] as const;

  const config = {
    locales: ['en', 'es'] as const,
    defaultLocale: 'en' as const,
    prefixStrategy: 'as-needed' as const,
    routes: {
      en: { '/about': '/about', '/blog/$slug': '/blog/$slug' },
      es: { '/about': '/sobre', '/blog/$slug': '/articulos/$slug' },
    },
    reverseRoutes: {
      en: { '/about': '/about', '/blog/$slug': '/blog/$slug' },
      es: { '/sobre': '/about', '/articulos/$slug': '/blog/$slug' },
    },
    routePatterns,
  };

  describe('deLocalizeUrl', () => {
    it('converts localized path to canonical', () => {
      const { deLocalizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/es/sobre');

      const result = deLocalizeUrl(url);

      expect(result.pathname).toBe('/es/about');
    });

    it('handles dynamic segments', () => {
      const { deLocalizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/es/articulos/my-post');

      const result = deLocalizeUrl(url);

      expect(result.pathname).toBe('/es/blog/my-post');
    });

    it('preserves dynamic segment values', () => {
      const { deLocalizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/es/usuarios/123/publicaciones');

      const result = deLocalizeUrl(url);

      expect(result.pathname).toBe('/es/users/123/posts');
    });

    it('returns unchanged URL when no locale in path', () => {
      const { deLocalizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/about');

      const result = deLocalizeUrl(url);

      expect(result.pathname).toBe('/about');
    });

    it('returns unchanged URL for root path', () => {
      const { deLocalizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/es/');

      const result = deLocalizeUrl(url);

      expect(result.pathname).toBe('/es/');
    });

    it('returns unchanged URL when already canonical', () => {
      const { deLocalizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/es/about');

      const result = deLocalizeUrl(url);

      // Already canonical, no change
      expect(result.pathname).toBe('/es/about');
    });
  });

  describe('localizeUrl', () => {
    it('converts canonical path to localized', () => {
      const { localizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/es/about');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/es/sobre');
    });

    it('handles dynamic segments', () => {
      const { localizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/es/blog/my-post');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/es/articulos/my-post');
    });

    it('strips prefix for default locale with as-needed strategy', () => {
      const { localizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/en/about');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/about');
    });

    it('strips prefix for root with default locale', () => {
      const { localizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/en/');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/');
    });

    it('returns unchanged URL when no locale in path', () => {
      const { localizeUrl } = createUrlRewriter(config);
      const url = new URL('http://localhost/about');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/about');
    });
  });
});

describe('createPrefixOnlyRewriter', () => {
  const config = {
    locales: ['en', 'es'] as const,
    defaultLocale: 'en' as const,
    prefixStrategy: 'as-needed' as const,
  };

  describe('localizeUrl', () => {
    it('strips prefix for default locale with as-needed strategy', () => {
      const { localizeUrl } = createPrefixOnlyRewriter(config);
      const url = new URL('http://localhost/en/about');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/about');
    });

    it('preserves prefix for non-default locale', () => {
      const { localizeUrl } = createPrefixOnlyRewriter(config);
      const url = new URL('http://localhost/es/about');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/es/about');
    });

    it('returns root path when stripping default locale prefix', () => {
      const { localizeUrl } = createPrefixOnlyRewriter(config);
      const url = new URL('http://localhost/en/');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/');
    });

    it('returns unchanged URL when no locale in path', () => {
      const { localizeUrl } = createPrefixOnlyRewriter(config);
      const url = new URL('http://localhost/about');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/about');
    });

    it('preserves prefix with always strategy', () => {
      const { localizeUrl } = createPrefixOnlyRewriter({
        ...config,
        prefixStrategy: 'always',
      });
      const url = new URL('http://localhost/en/about');

      const result = localizeUrl(url);

      expect(result.pathname).toBe('/en/about');
    });
  });
});
