import { describe, expect, it, vi } from 'vitest';
import {
  createIdiomiMiddleware,
  createMiddlewareFactory,
} from './middleware.js';

// Mock NextRequest with proper URL structure for Next.js middleware
const createMockRequest = (
  pathname: string,
  headers: Record<string, string> = {},
) => {
  const baseUrl = 'https://example.com';

  const createClonedUrl = () => {
    const url = new URL(pathname, baseUrl);
    return url;
  };

  return {
    nextUrl: Object.assign(new URL(pathname, baseUrl), {
      clone: createClonedUrl,
    }),
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    cookies: {
      get: (name: string) =>
        headers[`cookie:${name}`]
          ? { value: headers[`cookie:${name}`] }
          : undefined,
    },
  };
};

describe('createIdiomiMiddleware', () => {
  const baseConfig = {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    prefixStrategy: 'as-needed' as const,
  };

  describe('locale detection from path', () => {
    it('extracts locale from path when present', () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/es/about');

      const result = middleware(request as never);

      // Should not redirect - locale already in path
      expect(result).toBeUndefined();
    });

    it('redirects to default locale path when no locale in path (prefixStrategy: always)', () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const request = createMockRequest('/about');

      const result = middleware(request as never);

      expect(result?.status).toBe(307); // Temporary redirect
    });

    it('does not redirect for default locale when prefixStrategy is as-needed', () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/about');

      const result = middleware(request as never);

      // Should not redirect - as-needed means no prefix for default locale
      expect(result).toBeUndefined();
    });
  });

  describe('locale detection from cookie', () => {
    it('uses cookie locale when available', () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        detection: { cookieName: 'IDIOMA_LOCALE', order: ['cookie', 'header'] },
      });
      const request = createMockRequest('/about', {
        'cookie:IDIOMA_LOCALE': 'es',
      });

      const result = middleware(request as never);

      // Should redirect to Spanish version
      expect(result?.status).toBe(307);
    });
  });

  describe('locale detection from Accept-Language header', () => {
    it('uses Accept-Language when no cookie', () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        detection: { order: ['cookie', 'header'] },
      });
      const request = createMockRequest('/about', {
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      });

      const result = middleware(request as never);

      // Should redirect to Spanish version based on Accept-Language
      expect(result?.status).toBe(307);
    });
  });

  describe('localized paths rewriting', () => {
    it('rewrites localized path to canonical when routes provided', () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        routes: {
          en: { '/about': '/about' },
          es: { '/about': '/sobre' },
        },
        reverseRoutes: {
          en: { '/about': '/about' },
          es: { '/sobre': '/about' },
        },
      });
      const request = createMockRequest('/es/sobre');

      const result = middleware(request as never);

      // Should rewrite /es/sobre to /es/about internally
      expect(result?.headers?.get('x-idiomi-rewrite')).toBeDefined();
    });
  });

  describe('static file handling', () => {
    it('skips static files', () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/favicon.ico');

      const result = middleware(request as never);

      expect(result).toBeUndefined();
    });

    it('skips _next paths', () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/_next/static/chunk.js');

      const result = middleware(request as never);

      expect(result).toBeUndefined();
    });

    it('skips api routes', () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/api/users');

      const result = middleware(request as never);

      expect(result).toBeUndefined();
    });
  });
});

describe('locale negotiation with language distance', () => {
  it('matches en-GB to en-US via language distance', () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'de',
      locales: ['en-US', 'es', 'de'],
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about', {
      'accept-language': 'en-GB',
    });

    const result = middleware(request as never);

    // Should redirect to en-US (closest match to en-GB)
    expect(result?.status).toBe(307);
    expect(result?.headers.get('location')).toContain('/en-US/');
  });

  it('matches zh-TW to zh-Hant via script', () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'en',
      locales: ['en', 'zh-Hans', 'zh-Hant'],
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about', {
      'accept-language': 'zh-TW',
    });

    const result = middleware(request as never);

    // zh-TW should match zh-Hant (Traditional Chinese)
    expect(result?.status).toBe(307);
    expect(result?.headers.get('location')).toContain('/zh-Hant/');
  });

  it('matches pt-BR to pt-PT via language distance', () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'en',
      locales: ['pt-PT', 'es', 'en'],
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about', {
      'accept-language': 'pt-BR',
    });

    const result = middleware(request as never);

    // pt-BR should match pt-PT (same language family)
    expect(result?.status).toBe(307);
    expect(result?.headers.get('location')).toContain('/pt-PT/');
  });

  it('uses lookup algorithm when configured (strict matching)', () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'de',
      locales: ['en-US', 'de'],
      prefixStrategy: 'always',
      detection: { algorithm: 'lookup' },
    });
    const request = createMockRequest('/about', {
      'accept-language': 'en-GB',
    });

    const result = middleware(request as never);

    // With lookup, en-GB won't match en-US (no language distance)
    // Falls back to default locale (de)
    expect(result?.status).toBe(307);
    expect(result?.headers.get('location')).toContain('/de/');
  });

  it('preserves full locale codes in redirect', () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'en',
      locales: ['en-GB', 'en-US', 'en'],
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about', {
      'accept-language': 'en-GB',
    });

    const result = middleware(request as never);

    // Should match en-GB exactly
    expect(result?.status).toBe(307);
    expect(result?.headers.get('location')).toContain('/en-GB/');
  });

  it('respects quality factors with language distance', () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'en',
      locales: ['en', 'es', 'de'],
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about', {
      'accept-language': 'fr;q=0.9,es;q=0.8,de;q=0.3',
    });

    const result = middleware(request as never);

    // fr has no match, es is next highest priority
    expect(result?.status).toBe(307);
    expect(result?.headers.get('location')).toContain('/es/');
  });
});

describe('createMiddlewareFactory', () => {
  const factoryConfig = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    routes: {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
    },
    reverseRoutes: {
      en: { '/about': '/about' },
      es: { '/sobre': '/about' },
    },
  };

  it('returns a createMiddleware function', () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);

    expect(typeof createMiddleware).toBe('function');
  });

  it('createMiddleware returns a middleware function', () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);
    const middleware = createMiddleware();

    expect(typeof middleware).toBe('function');
  });

  it('middleware works with pre-baked config', () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);
    const middleware = createMiddleware();
    const request = createMockRequest('/es/sobre');

    const result = middleware(request as never);

    // Should rewrite localized path
    expect(result?.headers?.get('x-idiomi-rewrite')).toBeDefined();
  });

  it('allows runtime config overrides', () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);
    const middleware = createMiddleware({ prefixStrategy: 'always' });
    const request = createMockRequest('/about');

    const result = middleware(request as never);

    // Should redirect because prefixStrategy is 'always'
    expect(result?.status).toBe(307);
  });

  it('uses default prefixStrategy when not overridden', () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);
    const middleware = createMiddleware(); // No runtime config
    const request = createMockRequest('/about');

    const result = middleware(request as never);

    // Should not redirect with default 'as-needed' strategy for default locale
    expect(result).toBeUndefined();
  });
});
