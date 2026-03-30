/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocalizedPath } from './hooks.js';

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    locale: 'es',
    defaultLocale: 'en',
  }),
}));

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

  describe('with explicit locale override', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
      fr: { '/about': '/a-propos' },
    };

    it('uses the override locale instead of router locale', () => {
      const { result } = renderHook(() =>
        useLocalizedPath('/about', routes, 'fr'),
      );
      expect(result.current).toBe('/a-propos');
    });
  });

  describe('with dynamic segments', () => {
    const routes = {
      en: { '/blog/[slug]': '/blog/[slug]' },
      es: { '/blog/[slug]': '/articulos/[slug]' },
    };

    it('preserves dynamic segments in localized path', () => {
      const { result } = renderHook(() =>
        useLocalizedPath('/blog/[slug]', routes),
      );
      expect(result.current).toBe('/articulos/[slug]');
    });
  });
});
