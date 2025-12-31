import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIsomorphicLocaleDetector,
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

  describe('no server-side cookie setting (CDN cacheable)', () => {
    it('does not set cookie when locale detected from path', () => {
      const handleLocale = createRequestHandler(baseConfig);
      const ctx = createMockContext('/es/about');
      handleLocale(ctx);

      expect(ctx.responseHeaders.get('Set-Cookie')).toBeNull();
    });

    it('does not set cookie when locale detected from header', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['header'] },
      });
      const ctx = createMockContext('/about', {
        'accept-language': 'es-ES',
      });
      handleLocale(ctx);

      expect(ctx.responseHeaders.get('Set-Cookie')).toBeNull();
    });

    it('does not set cookie when locale detected from _idiomi param', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
      });
      const ctx = createMockContext('/about?_idiomi=fr');
      handleLocale(ctx);

      expect(ctx.responseHeaders.get('Set-Cookie')).toBeNull();
    });
  });

  describe('locale detection from _idiomi query param (edge middleware)', () => {
    it('uses _idiomi query param when present', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
      });
      const ctx = createMockContext('/about?_idiomi=es');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined();
    });

    it('prefers _idiomi over cookie detection', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['cookie', 'header'] },
      });
      const ctx = createMockContext('/about?_idiomi=fr', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('fr');
    });

    it('prefers _idiomi over Accept-Language header', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['header'] },
      });
      const ctx = createMockContext('/about?_idiomi=fr', {
        'accept-language': 'es-ES',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('fr');
    });

    it('path locale still wins over _idiomi', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
      });
      const ctx = createMockContext('/es/about?_idiomi=fr');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
    });

    it('ignores invalid _idiomi values', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['cookie'] },
      });
      const ctx = createMockContext('/about?_idiomi=invalid', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
    });

    it('falls back to cookie/header when _idiomi is missing', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['cookie', 'header'] },
      });
      const ctx = createMockContext('/about', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
    });

    it('works with always prefix strategy - uses _idiomi for redirect', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const ctx = createMockContext('/about?_idiomi=fr');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('fr');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/fr/about?_idiomi=fr',
      );
    });

    it('works with as-needed prefix strategy', () => {
      const handleLocale = createRequestHandler({
        ...baseConfig,
        prefixStrategy: 'as-needed',
      });
      const ctx = createMockContext('/about?_idiomi=es');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/es/about?_idiomi=es',
      );
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

describe('createIsomorphicLocaleDetector', () => {
  // Note: createIsomorphicLocaleDetector uses createIsomorphicFn from @tanstack/react-start
  // which can't be easily tested without mocking the entire module.
  // We test the factory returns a function with the right shape.
  // The actual detection logic is tested in detection.test.ts.

  it('returns a detectLocale function', () => {
    const detectLocale = createIsomorphicLocaleDetector({
      locales: ['en', 'es'],
      defaultLocale: 'en',
    });

    expect(typeof detectLocale).toBe('function');
  });
});
