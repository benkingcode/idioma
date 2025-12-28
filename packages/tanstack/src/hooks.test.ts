/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocale, useLocalizedPath } from './hooks.js';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({
    location: { pathname: '/about' },
  }),
  useParams: () => ({ lang: 'es' }),
}));

// Mock IdiomaContext
vi.mock('@idioma/react', () => ({
  IdiomaContext: {},
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
