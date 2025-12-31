import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLocaleDetector,
  createRequestHandler,
  type RequestHandlerConfig,
} from './server.js';

// Helper to create a mock Request
const createMockRequest = (
  url: string,
  headers: Record<string, string> = {},
) => {
  return new Request(`https://example.com${url}`, {
    headers: new Headers(headers),
  });
};

// Helper to create a mock TanStack Start context
const createMockContext = (
  url: string,
  headers: Record<string, string> = {},
) => ({
  request: createMockRequest(url, headers),
  responseHeaders: new Headers(),
});

describe('createRequestHandler', () => {
  const baseConfig: RequestHandlerConfig<'en' | 'es' | 'fr'> = {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    prefixStrategy: 'as-needed',
  };

  describe('locale detection from path', () => {
    it('extracts locale from path when present', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/es/about');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined();
    });

    it('redirects to add prefix when locale missing and prefixStrategy: always', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const ctx = createMockContext('/about');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('en');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/en/about',
      );
    });

    it('does not redirect for default locale when prefixStrategy is as-needed', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/about');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('en');
      expect(result.redirectResponse).toBeUndefined();
    });

    it('redirects to strip default locale prefix with as-needed strategy', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/en/about');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('en');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/about',
      );
    });
  });

  describe('locale detection from cookie', () => {
    it('uses cookie locale when available', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        detection: { cookieName: 'IDIOMI_LOCALE', order: ['cookie', 'header'] },
      });
      const ctx = createMockContext('/about', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/es/about',
      );
    });

    it('prefers cookie over header when order is [cookie, header]', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'always',
        detection: { order: ['cookie', 'header'] },
      });
      const ctx = createMockContext('/about', {
        cookie: 'IDIOMI_LOCALE=fr',
        'accept-language': 'es-ES,es;q=0.9',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('fr');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/fr/about',
      );
    });
  });

  describe('locale detection from Accept-Language header', () => {
    it('uses Accept-Language when no cookie', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        detection: { order: ['cookie', 'header'] },
      });
      const ctx = createMockContext('/about', {
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/es/about',
      );
    });
  });

  describe('static file handling', () => {
    it('skips static files with extensions', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/favicon.ico');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('en');
      expect(result.redirectResponse).toBeUndefined();
    });

    it('skips CSS files', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/styles/main.css');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('en');
      expect(result.redirectResponse).toBeUndefined();
    });

    it('skips JS files', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/assets/bundle.js');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('en');
      expect(result.redirectResponse).toBeUndefined();
    });

    it('skips _build paths', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/_build/manifest.json');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('en');
      expect(result.redirectResponse).toBeUndefined();
    });
  });

  describe('prefix strategy: never', () => {
    it('never redirects when prefixStrategy is never', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['header'] },
      });
      const ctx = createMockContext('/about', {
        'accept-language': 'es-ES',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined();
      // Should have rewritten URL for internal routing
      expect(result.localizedCtx.request.url).toBe(
        'https://example.com/es/about',
      );
    });

    it('uses locale from path when present with prefixStrategy: never', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
      });
      const ctx = createMockContext('/es/about');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined();
      // No rewrite needed - already has locale
      expect(result.localizedCtx.request.url).toBe(
        'https://example.com/es/about',
      );
    });
  });

  describe('query string and hash preservation', () => {
    it('preserves query string in redirect', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const ctx = createMockContext('/about?foo=bar');
      const result = handleLocale(ctx);

      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/en/about?foo=bar',
      );
    });

    it('preserves hash in redirect', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const ctx = createMockContext('/about#section');
      const result = handleLocale(ctx);

      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/en/about#section',
      );
    });
  });

  describe('cookie sync', () => {
    it('returns setCookie when locale detected from path', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/es/about');
      const result = handleLocale(ctx);

      // Locale is from path, cookie should be synced
      const setCookie = ctx.responseHeaders.get('Set-Cookie');
      expect(setCookie).toContain('IDIOMI_LOCALE=es');
    });

    it('does not set cookie when already matching', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/es/about', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      handleLocale(ctx);

      expect(ctx.responseHeaders.get('Set-Cookie')).toBeNull();
    });
  });

  describe('locale negotiation with language distance', () => {
    it('matches en-GB to en-US via language distance', () => {
      const handleLocale = createRequestHandler({
        defaultLocale: 'de',
        locales: ['en-US', 'es', 'de'],
        prefixStrategy: 'always',
      });
      const ctx = createMockContext('/about', {
        'accept-language': 'en-GB',
      });
      const result = handleLocale(ctx);

      expect(result.redirectResponse?.headers.get('Location')).toContain(
        '/en-US/',
      );
    });

    it('matches zh-TW to zh-Hant via script', () => {
      const handleLocale = createRequestHandler({
        defaultLocale: 'en',
        locales: ['en', 'zh-Hans', 'zh-Hant'],
        prefixStrategy: 'always',
      });
      const ctx = createMockContext('/about', {
        'accept-language': 'zh-TW',
      });
      const result = handleLocale(ctx);

      expect(result.redirectResponse?.headers.get('Location')).toContain(
        '/zh-Hant/',
      );
    });

    it('uses lookup algorithm when configured (strict matching)', () => {
      const handleLocale = createRequestHandler({
        defaultLocale: 'de',
        locales: ['en-US', 'de'],
        prefixStrategy: 'always',
        detection: { algorithm: 'lookup' },
      });
      const ctx = createMockContext('/about', {
        'accept-language': 'en-GB',
      });
      const result = handleLocale(ctx);

      // With lookup, en-GB won't match en-US - falls back to default (de)
      expect(result.redirectResponse?.headers.get('Location')).toContain(
        '/de/',
      );
    });
  });
});

describe('createLocaleDetector', () => {
  // Note: createLocaleDetector uses getRequestHeaders from @tanstack/react-start/server
  // which can't be easily tested without mocking the entire module.
  // We test the factory returns a function with the right shape.

  it('returns a detectLocale function', () => {
    const detectLocale = createLocaleDetector({
      locales: ['en', 'es'],
      defaultLocale: 'en',
    });

    expect(typeof detectLocale).toBe('function');
  });

  // Client-side detection tests would require jsdom environment
  // and mocking document.cookie and navigator.languages
});
