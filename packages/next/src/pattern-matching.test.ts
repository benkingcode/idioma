import { describe, expect, it } from 'vitest';
import {
  getCanonicalPath,
  getLocalizedPath,
  matchRoutePattern,
  reconstructPath,
  type RoutePattern,
} from './pattern-matching.js';

/**
 * Test suite for Next.js-specific pattern matching.
 *
 * Uses Next.js dynamic segment syntax:
 * - `[param]` - single dynamic segment
 * - `[...slug]` - catch-all segment
 * - `[[...optional]]` - optional catch-all segment
 */
describe('Next.js pattern matching', () => {
  describe('matchRoutePattern', () => {
    it('matches static route exactly', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['about'],
          localized: { en: ['about'], es: ['sobre'] },
        },
      ];

      const result = matchRoutePattern(['about'], patterns, 'en', false);

      expect(result).not.toBeNull();
      expect(result?.pattern.canonical).toEqual(['about']);
      expect(result?.captured).toEqual({});
    });

    it('matches [param] dynamic segment and captures value', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['blog', '[slug]'],
          localized: { en: ['blog', '[slug]'], es: ['articulos', '[slug]'] },
        },
      ];

      const result = matchRoutePattern(
        ['blog', 'hello-world'],
        patterns,
        'en',
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({ '[slug]': 'hello-world' });
    });

    it('matches localized path when useLocalized is true', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['blog', '[slug]'],
          localized: { en: ['blog', '[slug]'], es: ['articulos', '[slug]'] },
        },
      ];

      const result = matchRoutePattern(
        ['articulos', 'mi-post'],
        patterns,
        'es',
        true,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({ '[slug]': 'mi-post' });
    });

    it('matches [...slug] catch-all segment', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['docs', '[...path]'],
          localized: {
            en: ['docs', '[...path]'],
            es: ['documentos', '[...path]'],
          },
        },
      ];

      const result = matchRoutePattern(
        ['docs', 'api', 'v2', 'reference'],
        patterns,
        'en',
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({ '[...path]': 'api/v2/reference' });
    });

    it('matches [[...optional]] optional catch-all segment', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['docs', '[[...path]]'],
          localized: {
            en: ['docs', '[[...path]]'],
            es: ['documentos', '[[...path]]'],
          },
        },
      ];

      const result = matchRoutePattern(
        ['docs', 'getting-started'],
        patterns,
        'en',
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({ '[[...path]]': 'getting-started' });
    });

    it('matches multiple dynamic segments', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['users', '[userId]', 'posts', '[postId]'],
          localized: {
            en: ['users', '[userId]', 'posts', '[postId]'],
            es: ['usuarios', '[userId]', 'publicaciones', '[postId]'],
          },
        },
      ];

      const result = matchRoutePattern(
        ['users', '123', 'posts', '456'],
        patterns,
        'en',
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({
        '[userId]': '123',
        '[postId]': '456',
      });
    });

    it('returns null for non-matching path', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['blog', '[slug]'],
          localized: { en: ['blog', '[slug]'], es: ['articulos', '[slug]'] },
        },
      ];

      const result = matchRoutePattern(['contact'], patterns, 'en', false);

      expect(result).toBeNull();
    });

    it('prefers non-splat match over splat match', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['docs', '[...path]'],
          localized: {
            en: ['docs', '[...path]'],
            es: ['documentos', '[...path]'],
          },
        },
        {
          canonical: ['docs', 'api'],
          localized: { en: ['docs', 'api'], es: ['documentos', 'api'] },
        },
      ];

      const result = matchRoutePattern(['docs', 'api'], patterns, 'en', false);

      expect(result).not.toBeNull();
      expect(result?.pattern.canonical).toEqual(['docs', 'api']);
    });

    it('differentiates [param] from [...param] and [[...param]]', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['single', '[id]'],
          localized: { en: ['single', '[id]'], es: ['unico', '[id]'] },
        },
        {
          canonical: ['catch', '[...rest]'],
          localized: {
            en: ['catch', '[...rest]'],
            es: ['captura', '[...rest]'],
          },
        },
      ];

      // [id] should match single segment only
      const singleResult = matchRoutePattern(
        ['single', '42'],
        patterns,
        'en',
        false,
      );
      expect(singleResult?.pattern.canonical).toEqual(['single', '[id]']);
      expect(singleResult?.captured).toEqual({ '[id]': '42' });

      // [...rest] should match multiple segments
      const catchResult = matchRoutePattern(
        ['catch', 'a', 'b', 'c'],
        patterns,
        'en',
        false,
      );
      expect(catchResult?.pattern.canonical).toEqual(['catch', '[...rest]']);
      expect(catchResult?.captured).toEqual({ '[...rest]': 'a/b/c' });
    });
  });

  describe('reconstructPath', () => {
    it('reconstructs static path', () => {
      const result = reconstructPath(['about'], {});
      expect(result).toBe('/about');
    });

    it('reconstructs path with [param] segment', () => {
      const result = reconstructPath(['blog', '[slug]'], {
        '[slug]': 'hello-world',
      });
      expect(result).toBe('/blog/hello-world');
    });

    it('reconstructs path with [...slug] catch-all segment', () => {
      const result = reconstructPath(['docs', '[...path]'], {
        '[...path]': 'api/v2/reference',
      });
      expect(result).toBe('/docs/api/v2/reference');
    });

    it('reconstructs path with [[...optional]] segment', () => {
      const result = reconstructPath(['docs', '[[...path]]'], {
        '[[...path]]': 'guide/intro',
      });
      expect(result).toBe('/docs/guide/intro');
    });

    it('reconstructs path with multiple dynamic segments', () => {
      const result = reconstructPath(
        ['users', '[userId]', 'posts', '[postId]'],
        {
          '[userId]': '123',
          '[postId]': '456',
        },
      );
      expect(result).toBe('/users/123/posts/456');
    });

    it('returns / for empty segments', () => {
      const result = reconstructPath([], {});
      expect(result).toBe('/');
    });
  });

  describe('getLocalizedPath', () => {
    const routes = {
      en: { '/about': '/about', '/blog/[slug]': '/blog/[slug]' },
      es: { '/about': '/sobre', '/blog/[slug]': '/articulos/[slug]' },
    };

    const patterns: RoutePattern<'en' | 'es'>[] = [
      {
        canonical: ['blog', '[slug]'],
        localized: { en: ['blog', '[slug]'], es: ['articulos', '[slug]'] },
      },
    ];

    it('uses direct lookup for static routes', () => {
      const result = getLocalizedPath('/about', 'es', routes, patterns);
      expect(result).toBe('/sobre');
    });

    it('uses pattern matching for dynamic routes', () => {
      const result = getLocalizedPath('/blog/hello', 'es', routes, patterns);
      expect(result).toBe('/articulos/hello');
    });

    it('handles multiple dynamic segments', () => {
      const extendedPatterns: RoutePattern<'en' | 'es'>[] = [
        ...patterns,
        {
          canonical: ['users', '[userId]', 'posts', '[postId]'],
          localized: {
            en: ['users', '[userId]', 'posts', '[postId]'],
            es: ['usuarios', '[userId]', 'publicaciones', '[postId]'],
          },
        },
      ];

      const result = getLocalizedPath(
        '/users/42/posts/99',
        'es',
        routes,
        extendedPatterns,
      );
      expect(result).toBe('/usuarios/42/publicaciones/99');
    });

    it('handles catch-all routes', () => {
      const catchAllPatterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['docs', '[...path]'],
          localized: {
            en: ['docs', '[...path]'],
            es: ['documentos', '[...path]'],
          },
        },
      ];

      const result = getLocalizedPath(
        '/docs/api/v2/intro',
        'es',
        routes,
        catchAllPatterns,
      );
      expect(result).toBe('/documentos/api/v2/intro');
    });

    it('returns original path if no translation found', () => {
      const result = getLocalizedPath('/unknown', 'es', routes, patterns);
      expect(result).toBe('/unknown');
    });

    it('handles root path', () => {
      const result = getLocalizedPath('/', 'es', routes, patterns);
      expect(result).toBe('/');
    });
  });

  describe('getCanonicalPath', () => {
    const reverseRoutes = {
      en: { '/about': '/about', '/blog/[slug]': '/blog/[slug]' },
      es: { '/sobre': '/about', '/articulos/[slug]': '/blog/[slug]' },
    };

    const patterns: RoutePattern<'en' | 'es'>[] = [
      {
        canonical: ['blog', '[slug]'],
        localized: { en: ['blog', '[slug]'], es: ['articulos', '[slug]'] },
      },
    ];

    it('uses direct lookup for static routes', () => {
      const result = getCanonicalPath('/sobre', 'es', reverseRoutes, patterns);
      expect(result).toBe('/about');
    });

    it('uses pattern matching for dynamic routes', () => {
      const result = getCanonicalPath(
        '/articulos/mi-post',
        'es',
        reverseRoutes,
        patterns,
      );
      expect(result).toBe('/blog/mi-post');
    });

    it('handles multiple dynamic segments', () => {
      const extendedPatterns: RoutePattern<'en' | 'es'>[] = [
        ...patterns,
        {
          canonical: ['users', '[userId]', 'posts', '[postId]'],
          localized: {
            en: ['users', '[userId]', 'posts', '[postId]'],
            es: ['usuarios', '[userId]', 'publicaciones', '[postId]'],
          },
        },
      ];

      const result = getCanonicalPath(
        '/usuarios/42/publicaciones/99',
        'es',
        reverseRoutes,
        extendedPatterns,
      );
      expect(result).toBe('/users/42/posts/99');
    });

    it('handles catch-all routes', () => {
      const catchAllPatterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['docs', '[...path]'],
          localized: {
            en: ['docs', '[...path]'],
            es: ['documentos', '[...path]'],
          },
        },
      ];

      const result = getCanonicalPath(
        '/documentos/api/v2/intro',
        'es',
        reverseRoutes,
        catchAllPatterns,
      );
      expect(result).toBe('/docs/api/v2/intro');
    });

    it('returns original path if no translation found', () => {
      const result = getCanonicalPath(
        '/unknown',
        'es',
        reverseRoutes,
        patterns,
      );
      expect(result).toBe('/unknown');
    });

    it('handles root path', () => {
      const result = getCanonicalPath('/', 'es', reverseRoutes, patterns);
      expect(result).toBe('/');
    });
  });
});
