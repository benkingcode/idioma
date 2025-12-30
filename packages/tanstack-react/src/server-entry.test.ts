import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLocaleHandler,
  handleLocaleRequest,
  type LocaleServerEntryConfig,
} from './server-entry.js';

// Helper to create a mock Request
const createMockRequest = (
  url: string,
  headers: Record<string, string> = {},
) => {
  return new Request(`https://example.com${url}`, {
    headers: new Headers(headers),
  });
};

describe('handleLocaleRequest', () => {
  const baseConfig: LocaleServerEntryConfig<'en' | 'es' | 'fr'> = {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    prefixStrategy: 'as-needed',
  };

  describe('locale detection from path', () => {
    it('extracts locale from path when present', () => {
      const request = createMockRequest('/es/about');
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.locale).toBe('es');
      expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects to add prefix when locale missing and prefixStrategy: always', () => {
      const request = createMockRequest('/about');
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        prefixStrategy: 'always',
      });

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBe('https://example.com/en/about');
    });

    it('does not redirect for default locale when prefixStrategy is as-needed', () => {
      const request = createMockRequest('/about');
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects to strip default locale prefix with as-needed strategy', () => {
      const request = createMockRequest('/en/about');
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBe('https://example.com/about');
    });
  });

  describe('locale detection from cookie', () => {
    it('uses cookie locale when available', () => {
      const request = createMockRequest('/about', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        detection: { cookieName: 'IDIOMI_LOCALE', order: ['cookie', 'header'] },
      });

      expect(result.locale).toBe('es');
      expect(result.redirectUrl).toBe('https://example.com/es/about');
    });

    it('prefers cookie over header when order is [cookie, header]', () => {
      const request = createMockRequest('/about', {
        cookie: 'IDIOMI_LOCALE=fr',
        'accept-language': 'es-ES,es;q=0.9',
      });
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        prefixStrategy: 'always',
        detection: { order: ['cookie', 'header'] },
      });

      expect(result.locale).toBe('fr');
      expect(result.redirectUrl).toBe('https://example.com/fr/about');
    });
  });

  describe('locale detection from Accept-Language header', () => {
    it('uses Accept-Language when no cookie', () => {
      const request = createMockRequest('/about', {
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      });
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        detection: { order: ['cookie', 'header'] },
      });

      expect(result.locale).toBe('es');
      expect(result.redirectUrl).toBe('https://example.com/es/about');
    });
  });

  describe('static file handling', () => {
    it('skips static files with extensions', () => {
      const request = createMockRequest('/favicon.ico');
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBeUndefined();
      expect(result.rewrittenUrl).toBeUndefined();
    });

    it('skips CSS files', () => {
      const request = createMockRequest('/styles/main.css');
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBeUndefined();
    });

    it('skips JS files', () => {
      const request = createMockRequest('/assets/bundle.js');
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBeUndefined();
    });

    it('skips _build paths', () => {
      const request = createMockRequest('/_build/manifest.json');
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBeUndefined();
    });
  });

  describe('prefix strategy: never', () => {
    it('never redirects when prefixStrategy is never', () => {
      const request = createMockRequest('/about', {
        'accept-language': 'es-ES',
      });
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        prefixStrategy: 'never',
        detection: { order: ['header'] },
      });

      expect(result.locale).toBe('es');
      expect(result.redirectUrl).toBeUndefined();
      // Should have rewritten URL for internal routing
      expect(result.rewrittenUrl).toBe('https://example.com/es/about');
    });

    it('uses locale from path when present with prefixStrategy: never', () => {
      const request = createMockRequest('/es/about');
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        prefixStrategy: 'never',
      });

      expect(result.locale).toBe('es');
      expect(result.redirectUrl).toBeUndefined();
      expect(result.rewrittenUrl).toBeUndefined(); // already has locale
    });
  });

  describe('query string and hash preservation', () => {
    it('preserves query string in redirect', () => {
      const request = createMockRequest('/about?foo=bar');
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        prefixStrategy: 'always',
      });

      expect(result.redirectUrl).toBe('https://example.com/en/about?foo=bar');
    });

    it('preserves hash in redirect', () => {
      const request = createMockRequest('/about#section');
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        prefixStrategy: 'always',
      });

      expect(result.redirectUrl).toBe('https://example.com/en/about#section');
    });
  });

  describe('cookie sync', () => {
    it('returns setCookie when locale detected from header', () => {
      const request = createMockRequest('/es/about');
      const result = handleLocaleRequest(request, baseConfig);

      // Locale is from path, cookie should be synced
      expect(result.setCookie).toBeDefined();
      expect(result.setCookie).toContain('IDIOMI_LOCALE=es');
    });

    it('does not set cookie when already matching', () => {
      const request = createMockRequest('/es/about', {
        cookie: 'IDIOMI_LOCALE=es',
      });
      const result = handleLocaleRequest(request, baseConfig);

      expect(result.setCookie).toBeUndefined();
    });
  });

  describe('ignorePaths', () => {
    it('skips paths matching glob array', () => {
      const request = createMockRequest('/api/users');
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        ignorePaths: ['/api/*'],
      });

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBeUndefined();
    });

    it('skips paths matching regex string', () => {
      const request = createMockRequest('/dashboard/settings');
      const result = handleLocaleRequest(request, {
        ...baseConfig,
        ignorePaths: '^/dashboard',
      });

      expect(result.locale).toBe('en');
      expect(result.redirectUrl).toBeUndefined();
    });
  });
});

describe('locale negotiation with language distance', () => {
  it('matches en-GB to en-US via language distance', () => {
    const request = createMockRequest('/about', {
      'accept-language': 'en-GB',
    });
    const result = handleLocaleRequest(request, {
      defaultLocale: 'de',
      locales: ['en-US', 'es', 'de'],
      prefixStrategy: 'always',
    });

    expect(result.redirectUrl).toContain('/en-US/');
  });

  it('matches zh-TW to zh-Hant via script', () => {
    const request = createMockRequest('/about', {
      'accept-language': 'zh-TW',
    });
    const result = handleLocaleRequest(request, {
      defaultLocale: 'en',
      locales: ['en', 'zh-Hans', 'zh-Hant'],
      prefixStrategy: 'always',
    });

    expect(result.redirectUrl).toContain('/zh-Hant/');
  });

  it('uses lookup algorithm when configured (strict matching)', () => {
    const request = createMockRequest('/about', {
      'accept-language': 'en-GB',
    });
    const result = handleLocaleRequest(request, {
      defaultLocale: 'de',
      locales: ['en-US', 'de'],
      prefixStrategy: 'always',
      detection: { algorithm: 'lookup' },
    });

    // With lookup, en-GB won't match en-US - falls back to default (de)
    expect(result.redirectUrl).toContain('/de/');
  });
});

describe('createLocaleHandler', () => {
  const factoryConfig: LocaleServerEntryConfig<'en' | 'es' | 'fr'> = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    prefixStrategy: 'as-needed',
  };

  it('returns a handler function', () => {
    const handler = createLocaleHandler(factoryConfig);

    expect(typeof handler).toBe('function');
  });

  it('handler works correctly', () => {
    const handler = createLocaleHandler(factoryConfig);
    const request = createMockRequest('/es/about');
    const result = handler(request);

    expect(result.locale).toBe('es');
  });

  it('bakes config into handler', () => {
    const handler = createLocaleHandler({
      ...factoryConfig,
      prefixStrategy: 'always',
    });
    const request = createMockRequest('/about');
    const result = handler(request);

    expect(result.redirectUrl).toBe('https://example.com/en/about');
  });
});
