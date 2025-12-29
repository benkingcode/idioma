/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocale, useLocalizedHref, useLocalizedPath } from './hooks.js';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({
    location: { pathname: '/about' },
  }),
  useParams: () => ({ lang: 'es' }),
}));

// Mock IdiomiContext
vi.mock('@idiomi/react', () => ({
  IdiomiContext: {},
}));

// Mock React's useContext
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: () => ({ locale: 'es' }),
  };
});

describe('useLocale', () => {
  it('returns current locale from context', () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current).toBe('es');
  });
});

describe('useLocalizedPath', () => {
  describe('without routes', () => {
    it('returns the original path unchanged', () => {
      const { result } = renderHook(() => useLocalizedPath('/about'));
      expect(result.current).toBe('/about');
    });
  });

  describe('with routes', () => {
    const routes = {
      en: { '/about': '/about', '/blog': '/blog' },
      es: { '/about': '/sobre', '/blog': '/articulos' },
    };

    it('returns localized path for current locale', () => {
      const { result } = renderHook(() => useLocalizedPath('/about', routes));
      expect(result.current).toBe('/sobre');
    });

    it('returns original path when no translation exists', () => {
      const { result } = renderHook(() => useLocalizedPath('/contact', routes));
      expect(result.current).toBe('/contact');
    });
  });

  describe('with locale override', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
      fr: { '/about': '/a-propos' },
    };

    it('uses the override locale instead of context locale', () => {
      const { result } = renderHook(() =>
        useLocalizedPath('/about', routes, 'fr'),
      );
      expect(result.current).toBe('/a-propos');
    });
  });
});

describe('useLocalizedHref', () => {
  const routes = {
    en: { '/about': '/about', '/blog': '/blog' },
    es: { '/about': '/sobre', '/blog': '/articulos' },
    fr: { '/about': '/a-propos', '/blog': '/articles' },
  };

  describe('prefixStrategy: always', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'always' as const,
    };

    it('adds prefix for default locale', () => {
      const { result } = renderHook(() =>
        useLocalizedHref('/about', config, 'en'),
      );
      expect(result.current).toBe('/en/about');
    });

    it('adds prefix for non-default locale (from context)', () => {
      // Context locale is 'es'
      const { result } = renderHook(() => useLocalizedHref('/about', config));
      expect(result.current).toBe('/es/sobre');
    });
  });

  describe('prefixStrategy: as-needed', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'as-needed' as const,
    };

    it('does NOT add prefix for default locale', () => {
      const { result } = renderHook(() =>
        useLocalizedHref('/about', config, 'en'),
      );
      expect(result.current).toBe('/about');
    });

    it('adds prefix for non-default locale', () => {
      // Context locale is 'es'
      const { result } = renderHook(() => useLocalizedHref('/about', config));
      expect(result.current).toBe('/es/sobre');
    });
  });

  describe('prefixStrategy: never', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'never' as const,
    };

    it('never adds prefix', () => {
      // Context locale is 'es'
      const { result } = renderHook(() => useLocalizedHref('/about', config));
      expect(result.current).toBe('/sobre');
    });
  });

  it('returns original path when no config provided', () => {
    const { result } = renderHook(() => useLocalizedHref('/about'));
    expect(result.current).toBe('/about');
  });
});
