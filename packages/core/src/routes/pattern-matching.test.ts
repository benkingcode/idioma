import { describe, expect, it } from 'vitest';
import { createPatternMatcher, type RoutePattern } from './pattern-matching';

/**
 * Test suite for the core pattern matching factory.
 *
 * This module provides framework-agnostic pattern matching for localized routes.
 * Each framework (TanStack, Next.js) provides its own segment detectors.
 */
describe('createPatternMatcher', () => {
  // Next.js-style segment detectors
  const nextJsConfig = {
    isDynamicParam: (seg: string) =>
      seg.startsWith('[') && !seg.startsWith('[...') && !seg.startsWith('[['),
    isSplat: (seg: string) => seg.startsWith('[...') || seg.startsWith('[[...'),
  };

  // TanStack-style segment detectors
  const tanstackConfig = {
    isDynamicParam: (seg: string) =>
      seg.startsWith('$') || seg.startsWith('{$') || seg.startsWith('{-$'),
    isSplat: (seg: string) => seg === '$',
  };

  describe('with Next.js syntax', () => {
    const matcher = createPatternMatcher(nextJsConfig);

    describe('matchRoutePattern', () => {
      it('matches static route exactly', () => {
        const patterns: RoutePattern<'en' | 'es'>[] = [
          {
            canonical: ['about'],
            localized: { en: ['about'], es: ['sobre'] },
          },
        ];

        const result = matcher.matchRoutePattern(
          ['about'],
          patterns,
          'en',
          false,
        );
        expect(result).not.toBeNull();
        expect(result?.pattern.canonical).toEqual(['about']);
        expect(result?.captured).toEqual({});
      });

      it('matches dynamic segment and captures value', () => {
        const patterns: RoutePattern<'en' | 'es'>[] = [
          {
            canonical: ['blog', '[slug]'],
            localized: { en: ['blog', '[slug]'], es: ['articulos', '[slug]'] },
          },
        ];

        const result = matcher.matchRoutePattern(
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

        const result = matcher.matchRoutePattern(
          ['articulos', 'mi-post'],
          patterns,
          'es',
          true,
        );

        expect(result).not.toBeNull();
        expect(result?.captured).toEqual({ '[slug]': 'mi-post' });
      });

      it('matches catch-all segment [...slug]', () => {
        const patterns: RoutePattern<'en' | 'es'>[] = [
          {
            canonical: ['docs', '[...path]'],
            localized: {
              en: ['docs', '[...path]'],
              es: ['documentos', '[...path]'],
            },
          },
        ];

        const result = matcher.matchRoutePattern(
          ['docs', 'api', 'v2', 'reference'],
          patterns,
          'en',
          false,
        );

        expect(result).not.toBeNull();
        expect(result?.captured).toEqual({ '[...path]': 'api/v2/reference' });
      });

      it('matches optional catch-all segment [[...slug]]', () => {
        const patterns: RoutePattern<'en' | 'es'>[] = [
          {
            canonical: ['docs', '[[...path]]'],
            localized: {
              en: ['docs', '[[...path]]'],
              es: ['documentos', '[[...path]]'],
            },
          },
        ];

        const result = matcher.matchRoutePattern(
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

        const result = matcher.matchRoutePattern(
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

        const result = matcher.matchRoutePattern(
          ['contact'],
          patterns,
          'en',
          false,
        );

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

        const result = matcher.matchRoutePattern(
          ['docs', 'api'],
          patterns,
          'en',
          false,
        );

        expect(result).not.toBeNull();
        expect(result?.pattern.canonical).toEqual(['docs', 'api']);
      });
    });

    describe('reconstructPath', () => {
      it('reconstructs static path', () => {
        const result = matcher.reconstructPath(['about'], {});
        expect(result).toBe('/about');
      });

      it('reconstructs path with dynamic segment', () => {
        const result = matcher.reconstructPath(['blog', '[slug]'], {
          '[slug]': 'hello-world',
        });
        expect(result).toBe('/blog/hello-world');
      });

      it('reconstructs path with catch-all segment', () => {
        const result = matcher.reconstructPath(['docs', '[...path]'], {
          '[...path]': 'api/v2/reference',
        });
        expect(result).toBe('/docs/api/v2/reference');
      });

      it('returns / for empty segments', () => {
        const result = matcher.reconstructPath([], {});
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
        const result = matcher.getLocalizedPath(
          '/about',
          'es',
          routes,
          patterns,
        );
        expect(result).toBe('/sobre');
      });

      it('uses pattern matching for dynamic routes', () => {
        const result = matcher.getLocalizedPath(
          '/blog/hello',
          'es',
          routes,
          patterns,
        );
        expect(result).toBe('/articulos/hello');
      });

      it('returns original path if no translation found', () => {
        const result = matcher.getLocalizedPath(
          '/unknown',
          'es',
          routes,
          patterns,
        );
        expect(result).toBe('/unknown');
      });

      it('handles root path', () => {
        const result = matcher.getLocalizedPath('/', 'es', routes, patterns);
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
        const result = matcher.getCanonicalPath(
          '/sobre',
          'es',
          reverseRoutes,
          patterns,
        );
        expect(result).toBe('/about');
      });

      it('uses pattern matching for dynamic routes', () => {
        const result = matcher.getCanonicalPath(
          '/articulos/mi-post',
          'es',
          reverseRoutes,
          patterns,
        );
        expect(result).toBe('/blog/mi-post');
      });

      it('returns original path if no translation found', () => {
        const result = matcher.getCanonicalPath(
          '/unknown',
          'es',
          reverseRoutes,
          patterns,
        );
        expect(result).toBe('/unknown');
      });
    });
  });

  describe('with TanStack syntax', () => {
    const matcher = createPatternMatcher(tanstackConfig);

    it('matches TanStack dynamic segment $slug', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['blog', '$slug'],
          localized: { en: ['blog', '$slug'], es: ['articulos', '$slug'] },
        },
      ];

      const result = matcher.matchRoutePattern(
        ['blog', 'hello-world'],
        patterns,
        'en',
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({ $slug: 'hello-world' });
    });

    it('matches TanStack brace-wrapped segment {$param}', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['settings', '{$section}'],
          localized: {
            en: ['settings', '{$section}'],
            es: ['configuracion', '{$section}'],
          },
        },
      ];

      const result = matcher.matchRoutePattern(
        ['settings', 'privacy'],
        patterns,
        'en',
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({ '{$section}': 'privacy' });
    });

    it('matches TanStack splat segment $', () => {
      const patterns: RoutePattern<'en' | 'es'>[] = [
        {
          canonical: ['docs', '$'],
          localized: { en: ['docs', '$'], es: ['documentos', '$'] },
        },
      ];

      const result = matcher.matchRoutePattern(
        ['docs', 'api', 'v2', 'reference'],
        patterns,
        'en',
        false,
      );

      expect(result).not.toBeNull();
      expect(result?.captured).toEqual({ $: 'api/v2/reference' });
    });
  });
});
