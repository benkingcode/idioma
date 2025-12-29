import { describe, expect, it, vi } from 'vitest';
import {
  createIdiomaMiddleware,
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

describe('createIdiomaMiddleware', () => {
  const baseConfig = {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    prefixStrategy: 'as-needed' as const,
  };

  describe('locale detection from path', () => {
    it('extracts locale from path when present', () => {
      const middleware = createIdiomaMiddleware(baseConfig);
      const request = createMockRequest('/es/about');

      const result = middleware(request as never);

      // Should not redirect - locale already in path
      expect(result).toBeUndefined();
    });

    it('redirects to default locale path when no locale in path (prefixStrategy: always)', () => {
      const middleware = createIdiomaMiddleware({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const request = createMockRequest('/about');

      const result = middleware(request as never);

      expect(result?.status).toBe(307); // Temporary redirect
    });

    it('does not redirect for default locale when prefixStrategy is as-needed', () => {
      const middleware = createIdiomaMiddleware(baseConfig);
      const request = createMockRequest('/about');

      const result = middleware(request as never);

      // Should not redirect - as-needed means no prefix for default locale
      expect(result).toBeUndefined();
    });
  });

  describe('locale detection from cookie', () => {
    it('uses cookie locale when available', () => {
      const middleware = createIdiomaMiddleware({
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
      const middleware = createIdiomaMiddleware({
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
      const middleware = createIdiomaMiddleware({
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
      expect(result?.headers?.get('x-idioma-rewrite')).toBeDefined();
    });
  });

  describe('static file handling', () => {
    it('skips static files', () => {
      const middleware = createIdiomaMiddleware(baseConfig);
      const request = createMockRequest('/favicon.ico');

      const result = middleware(request as never);

      expect(result).toBeUndefined();
    });

    it('skips _next paths', () => {
      const middleware = createIdiomaMiddleware(baseConfig);
      const request = createMockRequest('/_next/static/chunk.js');

      const result = middleware(request as never);

      expect(result).toBeUndefined();
    });

    it('skips api routes', () => {
      const middleware = createIdiomaMiddleware(baseConfig);
      const request = createMockRequest('/api/users');

      const result = middleware(request as never);

      expect(result).toBeUndefined();
    });
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
    expect(result?.headers?.get('x-idioma-rewrite')).toBeDefined();
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
