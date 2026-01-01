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
  /**
   * Create a mock router that simulates TanStack Router's getMatchedRoutes.
   *
   * Takes a map of route IDs and returns a router with getMatchedRoutes that
   * matches pathnames to routes and extracts the locale param if present.
   */
  const createAllLocalizedRouter = (routeIds: string[]) => ({
    getMatchedRoutes: (pathname: string) => {
      // Simulate TanStack Router's matching logic for localized routes
      // For simplicity, we match by checking if the pathname (with optional locale prefix stripped)
      // matches a route pattern with the locale segment removed
      for (const routeId of routeIds) {
        const isLocalizedRoute = routeId.includes('{-$locale}');
        if (isLocalizedRoute) {
          // Route has optional locale segment like /{-$locale}/about
          // Match both /about and /es/about to this route
          const basePattern = routeId
            .replace('/{-$locale}', '')
            .replace(/^$/, '/');

          // Check if pathname matches with locale prefix
          const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*|$)/);
          if (localeMatch) {
            const rest = localeMatch[2] || '/';
            if (rest === basePattern || basePattern === '/') {
              return {
                foundRoute: { id: routeId },
                routeParams: { locale: localeMatch[1] },
                matchedRoutes: [],
              };
            }
          }
          // Check if pathname matches without locale prefix
          if (
            pathname === basePattern ||
            (basePattern === '/' && pathname === '/')
          ) {
            return {
              foundRoute: { id: routeId },
              routeParams: {},
              matchedRoutes: [],
            };
          }
        }
      }
      return { foundRoute: undefined, routeParams: {}, matchedRoutes: [] };
    },
  });

  // Mock router with all routes as localized (for tests that expect redirects)
  const allLocalizedRouter = createAllLocalizedRouter([
    '/{-$locale}/',
    '/{-$locale}/about',
    '/{-$locale}/settings',
  ]);

  const baseConfig: RequestHandlerConfig<'en' | 'es' | 'fr'> = {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    prefixStrategy: 'as-needed',
    localeParamName: 'locale',
    getRouter: () => allLocalizedRouter as any,
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
        localeParamName: 'locale',
        getRouter: () => allLocalizedRouter as any,
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
        localeParamName: 'locale',
        getRouter: () => allLocalizedRouter as any,
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
        localeParamName: 'locale',
        getRouter: () => allLocalizedRouter as any,
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

describe('route-based skipping with getRouter', () => {
  /**
   * Mock router that simulates TanStack Router's getMatchedRoutes method.
   *
   * Routes should use TanStack path syntax:
   * - `/{-$locale}/about` for localized routes (optional locale segment)
   * - `/dashboard` for non-localized routes
   *
   * The mock provides `getMatchedRoutes` which returns `foundRoute.id`
   * containing the original route pattern (used by `isLocalizedRoute`).
   */
  const createMockRouter = (
    routePatterns: Record<string, Record<string, unknown>>,
  ) => ({
    getMatchedRoutes: (pathname: string) => {
      // Try to match pathname against route patterns
      for (const [pattern, route] of Object.entries(routePatterns)) {
        const isLocalizedRoute = pattern.includes('{-$locale}');

        if (isLocalizedRoute) {
          // Optional locale segment like /{-$locale}/about
          // Matches both /about and /es/about
          const basePattern = pattern
            .replace('/{-$locale}', '')
            .replace(/^$/, '/');

          // Check if pathname matches with locale prefix
          const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*|$)/);
          if (localeMatch) {
            const rest = localeMatch[2] || '/';
            // Handle dynamic segments like $slug, {$id}
            const baseRegex = basePattern.replace(/\$\w+|\{\$\w+\}/g, '[^/]+');
            if (
              new RegExp(`^${baseRegex}$`).test(rest) ||
              (basePattern === '/' && rest === '/')
            ) {
              return {
                foundRoute: { id: pattern },
                routeParams: { locale: localeMatch[1] },
                matchedRoutes: [],
              };
            }
          }

          // Check if pathname matches without locale prefix
          const baseRegex = basePattern.replace(/\$\w+|\{\$\w+\}/g, '[^/]+');
          if (
            new RegExp(`^${baseRegex}$`).test(pathname) ||
            (basePattern === '/' && pathname === '/')
          ) {
            return {
              foundRoute: { id: pattern },
              routeParams: {},
              matchedRoutes: [],
            };
          }
        } else {
          // Non-localized route like /dashboard or /users/$userId
          const patternRegex = pattern.replace(/\$\w+|\{\$\w+\}/g, '[^/]+');
          if (new RegExp(`^${patternRegex}$`).test(pathname)) {
            return {
              foundRoute: { id: pattern },
              routeParams: {},
              matchedRoutes: [],
            };
          }
        }
      }

      // No route found
      return { foundRoute: undefined, routeParams: {}, matchedRoutes: [] };
    },
  });

  const baseConfig: RequestHandlerConfig<'en' | 'es' | 'fr'> = {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    prefixStrategy: 'as-needed',
  };

  it('skips prefix redirect for non-localized routes', () => {
    const router = createMockRouter({
      '/dashboard': {}, // No locale param - non-localized route
      '/{-$locale}/about': { id: 'about' }, // Has locale param - localized route
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      localeParamName: 'locale',
      getRouter: () => router as any,
      detection: { order: ['cookie', 'header'] },
    });

    // Non-localized /dashboard with Spanish cookie should NOT redirect
    const ctx = createMockContext('/dashboard', {
      cookie: 'IDIOMI_LOCALE=es',
    });
    const result = handleLocale(ctx);

    expect(result.locale).toBe('es'); // Detected from cookie
    expect(result.redirectResponse).toBeUndefined(); // No redirect!
  });

  it('applies prefix redirect for localized routes', () => {
    const router = createMockRouter({
      '/dashboard': {}, // No locale param - non-localized route
      '/{-$locale}/about': { id: 'about' }, // Has locale param - localized route
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      prefixStrategy: 'as-needed',
      localeParamName: 'locale',
      getRouter: () => router as any,
      detection: { order: ['cookie'] },
    });

    // Localized /about with Spanish cookie SHOULD redirect to /es/about
    const ctx = createMockContext('/about', {
      cookie: 'IDIOMI_LOCALE=es',
    });
    const result = handleLocale(ctx);

    expect(result.locale).toBe('es');
    expect(result.redirectResponse?.headers.get('Location')).toBe(
      'https://example.com/es/about',
    );
  });

  it('uses Accept-Language for non-localized routes without cookie', () => {
    const router = createMockRouter({
      '/dashboard': {}, // No locale param
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      localeParamName: 'locale',
      getRouter: () => router as any,
      detection: { order: ['cookie', 'header'] },
    });

    const ctx = createMockContext('/dashboard', {
      'accept-language': 'es-ES,es;q=0.9',
    });
    const result = handleLocale(ctx);

    expect(result.locale).toBe('es');
    expect(result.redirectResponse).toBeUndefined(); // No redirect for non-localized
  });

  it('falls back to defaultLocale for non-localized routes when no detection source matches', () => {
    const router = createMockRouter({
      '/dashboard': {}, // No locale param
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      localeParamName: 'locale',
      getRouter: () => router as any,
    });

    const ctx = createMockContext('/dashboard');
    const result = handleLocale(ctx);

    expect(result.locale).toBe('en'); // Falls back to default
    expect(result.redirectResponse).toBeUndefined();
  });

  it('skips redirects without getRouter (safer fallback)', () => {
    // No getRouter provided - fall back to non-localized (no redirects)
    const handleLocale = createRequestHandler({
      ...baseConfig,
      prefixStrategy: 'as-needed',
      detection: { order: ['cookie'] },
    });

    const ctx = createMockContext('/dashboard', {
      cookie: 'IDIOMI_LOCALE=es',
    });
    const result = handleLocale(ctx);

    // Without router, treat all routes as non-localized (no redirect)
    // Still detect locale from cookie for translations
    expect(result.locale).toBe('es');
    expect(result.redirectResponse).toBeUndefined();
  });

  it('skips redirect when route is not found by router (likely API or static)', () => {
    const router = createMockRouter({
      // /api/users is not in the router's routes (e.g., handled by server functions)
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      prefixStrategy: 'as-needed',
      localeParamName: 'locale',
      getRouter: () => router as any,
      detection: { order: ['cookie'] },
    });

    const ctx = createMockContext('/api/users', {
      cookie: 'IDIOMI_LOCALE=es',
    });
    const result = handleLocale(ctx);

    // Route not found in router - likely API route, skip redirect
    expect(result.locale).toBe('es'); // Still detect locale
    expect(result.redirectResponse).toBeUndefined(); // But no redirect
  });

  it('handles prefixStrategy: always correctly with non-localized routes', () => {
    const router = createMockRouter({
      '/api/users': {}, // API routes typically non-localized
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      prefixStrategy: 'always',
      localeParamName: 'locale',
      getRouter: () => router as any,
    });

    const ctx = createMockContext('/api/users');
    const result = handleLocale(ctx);

    // Non-localized route should still skip redirect even with 'always' strategy
    expect(result.locale).toBe('en');
    expect(result.redirectResponse).toBeUndefined();
  });

  it('handles prefixStrategy: never correctly with non-localized routes', () => {
    const router = createMockRouter({
      '/dashboard': {}, // Non-localized
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      prefixStrategy: 'never',
      localeParamName: 'locale',
      getRouter: () => router as any,
      detection: { order: ['cookie'] },
    });

    const ctx = createMockContext('/dashboard', {
      cookie: 'IDIOMI_LOCALE=es',
    });
    const result = handleLocale(ctx);

    // Non-localized route: detect locale, no rewrite needed
    expect(result.locale).toBe('es');
    expect(result.redirectResponse).toBeUndefined();
    // With 'never' strategy, non-localized routes don't need URL rewriting
    expect(result.localizedCtx.request.url).toBe(
      'https://example.com/dashboard',
    );
  });

  it('still rewrites localized routes with prefixStrategy: never', () => {
    const router = createMockRouter({
      '/{-$locale}/about': { id: 'about' }, // Localized route (has locale param)
    });

    const handleLocale = createRequestHandler({
      ...baseConfig,
      prefixStrategy: 'never',
      localeParamName: 'locale',
      getRouter: () => router as any,
      detection: { order: ['cookie'] },
    });

    const ctx = createMockContext('/about', {
      cookie: 'IDIOMI_LOCALE=es',
    });
    const result = handleLocale(ctx);

    // Localized route with 'never' strategy: detect locale and rewrite URL
    expect(result.locale).toBe('es');
    expect(result.redirectResponse).toBeUndefined();
    expect(result.localizedCtx.request.url).toBe(
      'https://example.com/es/about',
    );
  });

  describe('dynamic segment support', () => {
    it('matches localized routes with bare $slug params', () => {
      const router = createMockRouter({
        '/{-$locale}/blog/$slug': { id: 'blog-post' },
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        localeParamName: 'locale',
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      // Without locale prefix but with Spanish cookie → should redirect
      const ctx = createMockContext('/blog/my-first-post', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/es/blog/my-first-post',
      );
    });

    it('matches localized routes with {$id} required segment params', () => {
      const router = createMockRouter({
        '/{-$locale}/posts/{$id}': { id: 'post' },
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        localeParamName: 'locale',
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      // Without locale prefix but with Spanish cookie → should redirect
      const ctx = createMockContext('/posts/12345', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/es/posts/12345',
      );
    });

    it('correctly identifies non-localized routes with dynamic params', () => {
      const router = createMockRouter({
        '/users/$userId': { id: 'user-profile' }, // No locale param
        '/{-$locale}/blog/$slug': { id: 'blog-post' }, // Has locale param
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        localeParamName: 'locale',
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      // Non-localized route with dynamic param → NO redirect
      const ctx = createMockContext('/users/abc123', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es'); // Detected from cookie
      expect(result.redirectResponse).toBeUndefined(); // No redirect!
    });

    it('handles localized routes with locale prefix and dynamic params', () => {
      const router = createMockRouter({
        '/{-$locale}/blog/$slug': { id: 'blog-post' },
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        localeParamName: 'locale',
        getRouter: () => router as any,
      });

      // With locale prefix → no redirect needed
      const ctx = createMockContext('/es/blog/hello-world');
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined();
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

describe('isLocalizedRoute false positive prevention', () => {
  /**
   * These tests verify that the locale param detection doesn't
   * incorrectly match compound parameter names.
   *
   * For example, when localeParamName='locale':
   * - `{-$localedata}` should NOT match (it's a different param)
   * - `{-$locale}` SHOULD match (exact match)
   */

  const createMockRouter = (
    routePatterns: Record<string, Record<string, unknown>>,
  ) => ({
    getMatchedRoutes: (pathname: string) => {
      for (const [pattern] of Object.entries(routePatterns)) {
        // Handle optional segments: {-$param} matches with or without the segment
        // Handle required segments: {$param} and $param require the segment

        // Check for locale prefix in pathname
        const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*|$)/);
        const hasLocalePrefix = !!localeMatch;
        const pathWithoutPrefix = localeMatch
          ? localeMatch[2] || '/'
          : pathname;

        // Determine if this pattern has optional vs required locale param
        const hasOptionalLocale = /\{-\$\w+\}/.test(pattern);
        const hasRequiredLocale = /\{\$\w+\}|\$\w+/.test(pattern);

        // Build base pattern (remove locale segment for matching)
        let basePattern = pattern
          .replace(/\/?\{-\$\w+\}/, '') // Remove optional segment
          .replace(/^$/, '/'); // Handle root becoming empty

        // For required segments, we need to check if path has a prefix
        if (hasRequiredLocale && !hasOptionalLocale) {
          // Required locale - only match if path has locale prefix
          basePattern = pattern.replace(/\{\$\w+\}|\$\w+/g, '[^/]+');
          const regex = new RegExp(`^${basePattern}$`);
          if (regex.test(pathname)) {
            return {
              foundRoute: { id: pattern },
              routeParams: {},
              matchedRoutes: [],
            };
          }
        } else if (hasOptionalLocale) {
          // Optional locale - match with or without prefix
          // Convert remaining params to regex
          const baseRegex = basePattern.replace(/\{\$\w+\}|\$\w+/g, '[^/]+');

          // Match without locale prefix
          if (new RegExp(`^${baseRegex}$`).test(pathWithoutPrefix)) {
            return {
              foundRoute: { id: pattern },
              routeParams: {},
              matchedRoutes: [],
            };
          }
          // Also match with locale prefix
          if (
            hasLocalePrefix &&
            new RegExp(`^${baseRegex}$`).test(pathWithoutPrefix)
          ) {
            return {
              foundRoute: { id: pattern },
              routeParams: { locale: localeMatch[1] },
              matchedRoutes: [],
            };
          }
        } else {
          // No locale param at all - just match literally
          const baseRegex = pattern.replace(/\{\$\w+\}|\$\w+/g, '[^/]+');
          if (new RegExp(`^${baseRegex}$`).test(pathname)) {
            return {
              foundRoute: { id: pattern },
              routeParams: {},
              matchedRoutes: [],
            };
          }
        }
      }
      return { foundRoute: undefined, routeParams: {}, matchedRoutes: [] };
    },
  });

  const baseConfig = {
    defaultLocale: 'en' as const,
    locales: ['en', 'es', 'fr'] as const,
    prefixStrategy: 'as-needed' as const,
    localeParamName: 'locale',
  };

  describe('should NOT match compound param names (false positive prevention)', () => {
    it('does not match {-$localedata} when looking for {-$locale}', () => {
      // Route uses a compound param name that contains "locale" as substring
      const router = createMockRouter({
        '/{-$localedata}/settings': {}, // NOT a locale route, just happens to contain "locale"
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      // With Spanish cookie - should NOT redirect since this isn't a locale route
      const ctx = createMockContext('/settings', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es'); // Detected from cookie
      expect(result.redirectResponse).toBeUndefined(); // NO redirect - not a localized route!
    });

    it('does not match {$localeName} when looking for {$locale}', () => {
      const router = createMockRouter({
        '/{$localeName}/users': {}, // Different param, not a locale route
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      const ctx = createMockContext('/users', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined(); // Not a localized route
    });

    it('does not match $localeinfo when looking for $locale', () => {
      const router = createMockRouter({
        '/about/$localeinfo': {}, // Bare param that contains "locale"
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      const ctx = createMockContext('/about/test', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined(); // Not a localized route
    });
  });

  describe('should STILL match exact locale params (regression prevention)', () => {
    it('matches {-$locale} exactly (optional bracket syntax)', () => {
      const router = createMockRouter({
        '/{-$locale}/about': {},
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      const ctx = createMockContext('/about', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse?.headers.get('Location')).toBe(
        'https://example.com/es/about',
      ); // SHOULD redirect
    });

    it('matches {$locale} exactly (required bracket syntax)', () => {
      const router = createMockRouter({
        '/{$locale}/dashboard': {},
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      // For required segments, path must include locale to match the route
      const ctx = createMockContext('/es/dashboard', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      // With required segment and as-needed strategy, /es/dashboard stays as-is (non-default)
      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined(); // No redirect needed - already has locale
    });

    it('matches $locale exactly (bare syntax)', () => {
      const router = createMockRouter({
        '/$locale/posts': {},
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      // For bare required segments, path must include locale to match
      const ctx = createMockContext('/es/posts', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      expect(result.locale).toBe('es');
      expect(result.redirectResponse).toBeUndefined(); // No redirect - already has locale
    });
  });

  describe('boundary cases', () => {
    it('matches locale param at start of route ID', () => {
      const router = createMockRouter({
        '{-$locale}/home': {}, // No leading slash (edge case)
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      const ctx = createMockContext('/home', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      // Should match because {-$locale} is at start followed by /
      expect(result.redirectResponse).toBeDefined();
    });

    it('matches locale param at end of route ID', () => {
      const router = createMockRouter({
        '/settings/{-$locale}': {}, // Locale at end (unusual but valid)
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      const ctx = createMockContext('/settings', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      // Should match because {-$locale} is at end
      expect(result.redirectResponse).toBeDefined();
    });

    it('matches locale param in middle of route ID', () => {
      const router = createMockRouter({
        '/app/{-$locale}/settings': {},
      });

      const handleLocale = createRequestHandler({
        ...baseConfig,
        getRouter: () => router as any,
        detection: { order: ['cookie'] },
      });

      const ctx = createMockContext('/app/settings', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocale(ctx);

      // Should match because {-$locale} is between slashes
      expect(result.redirectResponse).toBeDefined();
    });
  });
});
