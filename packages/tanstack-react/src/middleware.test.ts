import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import after mocks
import {
  createIdiomiMiddleware,
  createMiddlewareFactory,
} from './middleware.js';

// Mock TanStack Start's createMiddleware
const mockNext = vi.fn();
const mockServer = vi.fn();

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (handler: Function) => {
      mockServer.mockImplementation(handler);
      return handler;
    },
  }),
}));

// Mock redirect to capture the throw
class RedirectError extends Error {
  to: string;
  constructor(options: { to: string }) {
    super('Redirect');
    this.to = options.to;
  }
}

vi.mock('@tanstack/react-router', () => ({
  redirect: (options: { to: string }) => {
    throw new RedirectError(options);
  },
}));

// Helper to create a mock Request
const createMockRequest = (
  url: string,
  headers: Record<string, string> = {},
) => {
  return {
    url: `https://example.com${url}`,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Request;
};

// Helper to capture context passed to next()
const captureContext = () => {
  let capturedContext: unknown;
  mockNext.mockImplementation(({ context } = {}) => {
    capturedContext = context;
    return Promise.resolve(new Response());
  });
  return () => capturedContext;
};

describe('createIdiomiMiddleware', () => {
  const baseConfig = {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    prefixStrategy: 'as-needed' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext.mockImplementation(() => Promise.resolve(new Response()));
  });

  describe('locale detection from path', () => {
    it('extracts locale from path when present', async () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/es/about');
      const getContext = captureContext();

      await middleware({ request, next: mockNext } as never);

      expect(getContext()).toEqual({ locale: 'es' });
    });

    it('redirects to default locale path when no locale in path (prefixStrategy: always)', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const request = createMockRequest('/about');

      await expect(
        middleware({ request, next: mockNext } as never),
      ).rejects.toThrow(RedirectError);

      try {
        await middleware({ request, next: mockNext } as never);
      } catch (e) {
        expect((e as RedirectError).to).toBe('/en/about');
      }
    });

    it('does not redirect for default locale when prefixStrategy is as-needed', async () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/about');
      const getContext = captureContext();

      await middleware({ request, next: mockNext } as never);

      expect(mockNext).toHaveBeenCalled();
      expect(getContext()).toEqual({ locale: 'en' });
    });
  });

  describe('locale detection from cookie', () => {
    it('uses cookie locale when available', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        detection: { cookieName: 'IDIOMI_LOCALE', order: ['cookie', 'header'] },
      });
      const request = createMockRequest('/about', {
        cookie: 'IDIOMI_LOCALE=es',
      });

      await expect(
        middleware({ request, next: mockNext } as never),
      ).rejects.toThrow(RedirectError);

      try {
        await middleware({ request, next: mockNext } as never);
      } catch (e) {
        expect((e as RedirectError).to).toBe('/es/about');
      }
    });

    it('prefers cookie over header when order is [cookie, header]', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'always',
        detection: { order: ['cookie', 'header'] },
      });
      const request = createMockRequest('/about', {
        cookie: 'IDIOMA_LOCALE=fr',
        'accept-language': 'es-ES,es;q=0.9',
      });

      try {
        await middleware({ request, next: mockNext } as never);
      } catch (e) {
        expect((e as RedirectError).to).toBe('/fr/about');
      }
    });
  });

  describe('locale detection from Accept-Language header', () => {
    it('uses Accept-Language when no cookie', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        detection: { order: ['cookie', 'header'] },
      });
      const request = createMockRequest('/about', {
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      });

      await expect(
        middleware({ request, next: mockNext } as never),
      ).rejects.toThrow(RedirectError);

      try {
        await middleware({ request, next: mockNext } as never);
      } catch (e) {
        expect((e as RedirectError).to).toBe('/es/about');
      }
    });
  });

  describe('static file handling', () => {
    it('skips static files with extensions', async () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/favicon.ico');

      await middleware({ request, next: mockNext } as never);

      expect(mockNext).toHaveBeenCalled();
      // Should call next() without context (skip processing)
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('skips CSS files', async () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/styles/main.css');

      await middleware({ request, next: mockNext } as never);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('skips JS files', async () => {
      const middleware = createIdiomiMiddleware(baseConfig);
      const request = createMockRequest('/assets/bundle.js');

      await middleware({ request, next: mockNext } as never);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('prefix strategy: never', () => {
    it('never redirects when prefixStrategy is never', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['header'] },
      });
      const request = createMockRequest('/about', {
        'accept-language': 'es-ES',
      });
      const getContext = captureContext();

      await middleware({ request, next: mockNext } as never);

      expect(mockNext).toHaveBeenCalled();
      expect(getContext()).toEqual({ locale: 'es' });
    });

    it('still detects locale from path when prefixStrategy is never', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'never',
      });
      const request = createMockRequest('/es/about');
      const getContext = captureContext();

      await middleware({ request, next: mockNext } as never);

      expect(getContext()).toEqual({ locale: 'es' });
    });
  });

  describe('query string and hash preservation', () => {
    it('preserves query string in redirect', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const request = createMockRequest('/about?foo=bar');

      try {
        await middleware({ request, next: mockNext } as never);
      } catch (e) {
        expect((e as RedirectError).to).toBe('/en/about?foo=bar');
      }
    });

    it('preserves hash in redirect', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const request = createMockRequest('/about#section');

      try {
        await middleware({ request, next: mockNext } as never);
      } catch (e) {
        expect((e as RedirectError).to).toBe('/en/about#section');
      }
    });

    it('preserves both query string and hash in redirect', async () => {
      const middleware = createIdiomiMiddleware({
        ...baseConfig,
        prefixStrategy: 'always',
      });
      const request = createMockRequest('/about?foo=bar#section');

      try {
        await middleware({ request, next: mockNext } as never);
      } catch (e) {
        expect((e as RedirectError).to).toBe('/en/about?foo=bar#section');
      }
    });
  });
});

describe('locale negotiation with language distance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNext.mockImplementation(() => Promise.resolve(new Response()));
  });

  it('matches en-GB to en-US via language distance', async () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'de',
      locales: ['en-US', 'es', 'de'],
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about', {
      'accept-language': 'en-GB',
    });

    try {
      await middleware({ request, next: mockNext } as never);
    } catch (e) {
      expect((e as RedirectError).to).toContain('/en-US/');
    }
  });

  it('matches zh-TW to zh-Hant via script', async () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'en',
      locales: ['en', 'zh-Hans', 'zh-Hant'],
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about', {
      'accept-language': 'zh-TW',
    });

    try {
      await middleware({ request, next: mockNext } as never);
    } catch (e) {
      expect((e as RedirectError).to).toContain('/zh-Hant/');
    }
  });

  it('uses lookup algorithm when configured (strict matching)', async () => {
    const middleware = createIdiomiMiddleware({
      defaultLocale: 'de',
      locales: ['en-US', 'de'],
      prefixStrategy: 'always',
      detection: { algorithm: 'lookup' },
    });
    const request = createMockRequest('/about', {
      'accept-language': 'en-GB',
    });

    try {
      await middleware({ request, next: mockNext } as never);
    } catch (e) {
      // With lookup, en-GB won't match en-US - falls back to default (de)
      expect((e as RedirectError).to).toContain('/de/');
    }
  });
});

describe('createMiddlewareFactory', () => {
  const factoryConfig = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext.mockImplementation(() => Promise.resolve(new Response()));
  });

  it('returns a createMiddleware function', () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);

    expect(typeof createMiddleware).toBe('function');
  });

  it('createMiddleware returns a middleware function', () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);
    const middleware = createMiddleware();

    expect(typeof middleware).toBe('function');
  });

  it('allows runtime config overrides', async () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);
    const middleware = createMiddleware({ prefixStrategy: 'always' });
    const request = createMockRequest('/about');

    await expect(
      middleware({ request, next: mockNext } as never),
    ).rejects.toThrow(RedirectError);
  });

  it('uses default prefixStrategy when not overridden', async () => {
    const createMiddleware = createMiddlewareFactory(factoryConfig);
    const middleware = createMiddleware();
    const request = createMockRequest('/about');
    const getContext = () => {
      let ctx: unknown;
      mockNext.mockImplementation(({ context } = {}) => {
        ctx = context;
        return Promise.resolve(new Response());
      });
      return ctx;
    };

    await middleware({ request, next: mockNext } as never);

    // Should not redirect with default 'as-needed' strategy for default locale
    expect(mockNext).toHaveBeenCalled();
  });
});
