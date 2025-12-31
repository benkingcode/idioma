import { describe, expect, it } from 'vitest';
import type { Message } from '../po/types.js';
import {
  compileRoutes,
  generateRoutesModule,
  ROUTE_CONTEXT_PREFIX,
} from './compile.js';
import {
  getTranslatableSegments,
  isDynamicSegment,
  isRouteGroup,
} from './types.js';
import type { ExtractedRoute } from './types.js';

describe('route types', () => {
  describe('isDynamicSegment', () => {
    describe('Next.js syntax', () => {
      it('identifies dynamic segments', () => {
        expect(isDynamicSegment('[slug]', 'next-app')).toBe(true);
        expect(isDynamicSegment('[...slug]', 'next-app')).toBe(true);
        expect(isDynamicSegment('[[...slug]]', 'next-app')).toBe(true);
        expect(isDynamicSegment('[id]', 'next-app')).toBe(true);
      });

      it('identifies static segments', () => {
        expect(isDynamicSegment('about', 'next-app')).toBe(false);
        expect(isDynamicSegment('blog', 'next-app')).toBe(false);
        expect(isDynamicSegment('contact-us', 'next-app')).toBe(false);
      });

      it('does not recognize TanStack syntax', () => {
        expect(isDynamicSegment('$slug', 'next-app')).toBe(false);
        expect(isDynamicSegment('{$locale}', 'next-app')).toBe(false);
      });
    });

    describe('TanStack syntax', () => {
      it('identifies dynamic segments', () => {
        expect(isDynamicSegment('$slug', 'tanstack')).toBe(true);
        expect(isDynamicSegment('$userId', 'tanstack')).toBe(true);
        expect(isDynamicSegment('$', 'tanstack')).toBe(true); // splat
        expect(isDynamicSegment('{$locale}', 'tanstack')).toBe(true);
        expect(isDynamicSegment('{-$locale}', 'tanstack')).toBe(true);
      });

      it('identifies static segments', () => {
        expect(isDynamicSegment('about', 'tanstack')).toBe(false);
        expect(isDynamicSegment('blog', 'tanstack')).toBe(false);
        expect(isDynamicSegment('contact-us', 'tanstack')).toBe(false);
      });

      it('does not recognize Next.js syntax', () => {
        expect(isDynamicSegment('[slug]', 'tanstack')).toBe(false);
        expect(isDynamicSegment('[...slug]', 'tanstack')).toBe(false);
      });
    });
  });

  describe('isRouteGroup', () => {
    it('identifies route groups', () => {
      expect(isRouteGroup('(marketing)')).toBe(true);
      expect(isRouteGroup('(auth)')).toBe(true);
      expect(isRouteGroup('(dashboard)')).toBe(true);
    });

    it('identifies non-groups', () => {
      expect(isRouteGroup('about')).toBe(false);
      expect(isRouteGroup('[slug]')).toBe(false);
      expect(isRouteGroup('blog-posts')).toBe(false);
    });
  });

  describe('getTranslatableSegments', () => {
    it('filters out Next.js dynamic segments and groups', () => {
      const segments = ['(marketing)', 'blog', '[slug]', 'comments'];
      expect(getTranslatableSegments(segments, 'next-app')).toEqual([
        'blog',
        'comments',
      ]);
    });

    it('filters out TanStack dynamic segments and groups', () => {
      const segments = ['(marketing)', 'blog', '$slug', 'comments'];
      expect(getTranslatableSegments(segments, 'tanstack')).toEqual([
        'blog',
        'comments',
      ]);
    });

    it('handles empty array', () => {
      expect(getTranslatableSegments([], 'next-app')).toEqual([]);
    });

    it('handles all dynamic/group segments', () => {
      const segments = ['(auth)', '[userId]', '[[...params]]'];
      expect(getTranslatableSegments(segments, 'next-app')).toEqual([]);
    });
  });
});

describe('compileRoutes', () => {
  it('compiles routes with translated segments', () => {
    const routes: ExtractedRoute[] = [
      {
        path: '/about',
        source: 'app/about/page.tsx',
        type: 'page',
        segments: ['about'],
      },
      {
        path: '/blog',
        source: 'app/blog/page.tsx',
        type: 'page',
        segments: ['blog'],
      },
    ];

    const messages: Record<string, Message[]> = {
      en: [
        {
          key: 'abc',
          source: 'about',
          translation: 'about',
          context: 'route:about',
        },
        {
          key: 'def',
          source: 'blog',
          translation: 'blog',
          context: 'route:blog',
        },
      ],
      es: [
        {
          key: 'abc',
          source: 'about',
          translation: 'sobre',
          context: 'route:about',
        },
        {
          key: 'def',
          source: 'blog',
          translation: 'articulos',
          context: 'route:blog',
        },
      ],
    };

    const compiled = compileRoutes(routes, messages, ['en', 'es'], 'next-app');

    // Check full route maps
    expect(compiled.routes.en).toEqual({
      '/about': '/about',
      '/blog': '/blog',
    });
    expect(compiled.routes.es).toEqual({
      '/about': '/sobre',
      '/blog': '/articulos',
    });

    // Check reverse maps
    expect(compiled.reverseRoutes.en).toEqual({
      '/about': '/about',
      '/blog': '/blog',
    });
    expect(compiled.reverseRoutes.es).toEqual({
      '/sobre': '/about',
      '/articulos': '/blog',
    });
  });

  it('preserves dynamic segments in paths', () => {
    const routes: ExtractedRoute[] = [
      {
        path: '/blog/[slug]',
        source: 'app/blog/[slug]/page.tsx',
        type: 'page',
        segments: ['blog', '[slug]'],
      },
    ];

    const messages: Record<string, Message[]> = {
      en: [
        {
          key: 'abc',
          source: 'blog',
          translation: 'blog',
          context: 'route:blog',
        },
      ],
      es: [
        {
          key: 'abc',
          source: 'blog',
          translation: 'articulos',
          context: 'route:blog',
        },
      ],
    };

    const compiled = compileRoutes(routes, messages, ['en', 'es'], 'next-app');

    expect(compiled.routes.en['/blog/[slug]']).toBe('/blog/[slug]');
    expect(compiled.routes.es['/blog/[slug]']).toBe('/articulos/[slug]');
  });

  it('handles missing translations gracefully', () => {
    const routes: ExtractedRoute[] = [
      {
        path: '/about',
        source: 'app/about/page.tsx',
        type: 'page',
        segments: ['about'],
      },
    ];

    // French has no translations
    const messages: Record<string, Message[]> = {
      en: [
        {
          key: 'abc',
          source: 'about',
          translation: 'about',
          context: 'route:about',
        },
      ],
      fr: [],
    };

    const compiled = compileRoutes(routes, messages, ['en', 'fr'], 'next-app');

    expect(compiled.routes.en['/about']).toBe('/about');
    expect(compiled.routes.fr['/about']).toBe('/about'); // Falls back to original
  });

  it('ignores non-route context messages', () => {
    const routes: ExtractedRoute[] = [
      {
        path: '/about',
        source: 'app/about/page.tsx',
        type: 'page',
        segments: ['about'],
      },
    ];

    const messages: Record<string, Message[]> = {
      en: [
        {
          key: 'abc',
          source: 'about',
          translation: 'about',
          context: 'route:about',
        },
        {
          key: 'xyz',
          source: 'Submit',
          translation: 'Submit',
          context: 'button',
        }, // Not a route
      ],
    };

    const compiled = compileRoutes(routes, messages, ['en'], 'next-app');

    // Only the route context message should be used
    expect(compiled.routes.en).toEqual({ '/about': '/about' });
    expect(Object.keys(compiled.routes.en)).toHaveLength(1);
  });

  it('preserves TanStack dynamic segments in paths', () => {
    const routes: ExtractedRoute[] = [
      {
        path: '/blog/$slug',
        source: 'src/routes/blog.$slug.tsx',
        type: 'page',
        segments: ['blog', '$slug'],
      },
    ];

    const messages: Record<string, Message[]> = {
      en: [
        {
          key: 'abc',
          source: 'blog',
          translation: 'blog',
          context: 'route:blog',
        },
      ],
      es: [
        {
          key: 'abc',
          source: 'blog',
          translation: 'articulos',
          context: 'route:blog',
        },
      ],
    };

    const compiled = compileRoutes(routes, messages, ['en', 'es'], 'tanstack');

    expect(compiled.routes.en['/blog/$slug']).toBe('/blog/$slug');
    expect(compiled.routes.es['/blog/$slug']).toBe('/articulos/$slug');
  });

  describe('pattern generation', () => {
    it('generates patterns for static routes', () => {
      const routes: ExtractedRoute[] = [
        {
          path: '/about',
          source: 'app/about/page.tsx',
          type: 'page',
          segments: ['about'],
        },
      ];

      const messages: Record<string, Message[]> = {
        en: [
          {
            key: 'abc',
            source: 'about',
            translation: 'about',
            context: 'route:about',
          },
        ],
        es: [
          {
            key: 'abc',
            source: 'about',
            translation: 'sobre',
            context: 'route:about',
          },
        ],
      };

      const compiled = compileRoutes(
        routes,
        messages,
        ['en', 'es'],
        'next-app',
      );

      expect(compiled.patterns).toHaveLength(1);
      expect(compiled.patterns[0]).toEqual({
        canonical: ['about'],
        localized: {
          en: ['about'],
          es: ['sobre'],
        },
      });
    });

    it('generates patterns preserving dynamic segments for TanStack', () => {
      const routes: ExtractedRoute[] = [
        {
          path: '/users/$userId',
          source: 'src/routes/users.$userId.tsx',
          type: 'page',
          segments: ['users', '$userId'],
        },
        {
          path: '/users/$userId/posts',
          source: 'src/routes/users.$userId.posts.tsx',
          type: 'page',
          segments: ['users', '$userId', 'posts'],
        },
      ];

      const messages: Record<string, Message[]> = {
        en: [
          {
            key: 'a',
            source: 'users',
            translation: 'users',
            context: 'route:users',
          },
          {
            key: 'b',
            source: 'posts',
            translation: 'posts',
            context: 'route:posts',
          },
        ],
        es: [
          {
            key: 'a',
            source: 'users',
            translation: 'usuarios',
            context: 'route:users',
          },
          {
            key: 'b',
            source: 'posts',
            translation: 'publicaciones',
            context: 'route:posts',
          },
        ],
      };

      const compiled = compileRoutes(
        routes,
        messages,
        ['en', 'es'],
        'tanstack',
      );

      expect(compiled.patterns).toHaveLength(2);

      // Pattern for /users/$userId
      expect(compiled.patterns[0]).toEqual({
        canonical: ['users', '$userId'],
        localized: {
          en: ['users', '$userId'],
          es: ['usuarios', '$userId'],
        },
      });

      // Pattern for /users/$userId/posts
      expect(compiled.patterns[1]).toEqual({
        canonical: ['users', '$userId', 'posts'],
        localized: {
          en: ['users', '$userId', 'posts'],
          es: ['usuarios', '$userId', 'publicaciones'],
        },
      });
    });

    it('generates patterns with consecutive dynamic segments', () => {
      const routes: ExtractedRoute[] = [
        {
          path: '/shop/$category/$productId',
          source: 'src/routes/shop.$category.$productId.tsx',
          type: 'page',
          segments: ['shop', '$category', '$productId'],
        },
      ];

      const messages: Record<string, Message[]> = {
        en: [
          {
            key: 'a',
            source: 'shop',
            translation: 'shop',
            context: 'route:shop',
          },
        ],
        es: [
          {
            key: 'a',
            source: 'shop',
            translation: 'tienda',
            context: 'route:shop',
          },
        ],
      };

      const compiled = compileRoutes(
        routes,
        messages,
        ['en', 'es'],
        'tanstack',
      );

      expect(compiled.patterns[0]).toEqual({
        canonical: ['shop', '$category', '$productId'],
        localized: {
          en: ['shop', '$category', '$productId'],
          es: ['tienda', '$category', '$productId'],
        },
      });
    });

    it('generates patterns for deeply nested static routes', () => {
      const routes: ExtractedRoute[] = [
        {
          path: '/docs/api/v2/reference',
          source: 'src/routes/docs.api.v2.reference.tsx',
          type: 'page',
          segments: ['docs', 'api', 'v2', 'reference'],
        },
      ];

      const messages: Record<string, Message[]> = {
        en: [
          {
            key: 'a',
            source: 'docs',
            translation: 'docs',
            context: 'route:docs',
          },
          {
            key: 'b',
            source: 'reference',
            translation: 'reference',
            context: 'route:reference',
          },
        ],
        es: [
          {
            key: 'a',
            source: 'docs',
            translation: 'documentos',
            context: 'route:docs',
          },
          {
            key: 'b',
            source: 'reference',
            translation: 'referencia',
            context: 'route:reference',
          },
        ],
      };

      const compiled = compileRoutes(
        routes,
        messages,
        ['en', 'es'],
        'tanstack',
      );

      expect(compiled.patterns[0]).toEqual({
        canonical: ['docs', 'api', 'v2', 'reference'],
        localized: {
          en: ['docs', 'api', 'v2', 'reference'],
          es: ['documentos', 'api', 'v2', 'referencia'],
        },
      });
    });
  });
});

describe('generateRoutesModule', () => {
  it('generates valid JavaScript module for TanStack', () => {
    const compiled = {
      routes: { en: { '/about': '/about' }, es: { '/about': '/sobre' } },
      reverseRoutes: { en: { '/about': '/about' }, es: { '/sobre': '/about' } },
      patterns: [
        {
          canonical: ['about'],
          localized: { en: ['about'], es: ['sobre'] },
        },
      ],
    };

    const code = generateRoutesModule(compiled, 'tanstack');

    expect(code).toContain('export const routes =');
    expect(code).toContain('export const reverseRoutes =');
    expect(code).toContain('export const routePatterns =');
    expect(code).toContain('export function getLocalizedPath');
    expect(code).toContain('export function getCanonicalPath');
    expect(code).toContain('Auto-generated by @idiomi/core');
    // Should import from @idiomi/tanstack-react/pattern-matching
    expect(code).toContain(
      "import { getLocalizedPath as _getLocalizedPath, getCanonicalPath as _getCanonicalPath } from '@idiomi/tanstack-react/pattern-matching'",
    );
    // segments should NOT be exported
    expect(code).not.toContain('export const segments');
  });

  it('generates minimal JavaScript module for Next.js', () => {
    const compiled = {
      routes: { en: { '/about': '/about' }, es: { '/about': '/sobre' } },
      reverseRoutes: { en: { '/about': '/about' }, es: { '/sobre': '/about' } },
      patterns: [
        {
          canonical: ['about'],
          localized: { en: ['about'], es: ['sobre'] },
        },
      ],
    };

    const code = generateRoutesModule(compiled, 'next-app');

    expect(code).toContain('export const routes =');
    expect(code).toContain('export const reverseRoutes =');
    expect(code).toContain('Auto-generated by @idiomi/core');
    // Should NOT include pattern matching for Next.js
    expect(code).not.toContain('routePatterns');
    expect(code).not.toContain('getLocalizedPath');
    expect(code).not.toContain('getCanonicalPath');
    expect(code).not.toContain('@idiomi/tanstack-react');
  });

  it('exports routePatterns with correct structure for TanStack', () => {
    const compiled = {
      routes: { en: { '/users/$userId': '/users/$userId' } },
      reverseRoutes: { en: { '/users/$userId': '/users/$userId' } },
      patterns: [
        {
          canonical: ['users', '$userId'],
          localized: {
            en: ['users', '$userId'],
            es: ['usuarios', '$userId'],
          },
        },
      ],
    };

    const code = generateRoutesModule(compiled, 'tanstack');

    expect(code).toContain('"canonical": [');
    expect(code).toContain('"users"');
    expect(code).toContain('"$userId"');
    expect(code).toContain('"localized": {');
    expect(code).toContain('"usuarios"');
  });
});

describe('ROUTE_CONTEXT_PREFIX', () => {
  it('is set to route:', () => {
    expect(ROUTE_CONTEXT_PREFIX).toBe('route:');
  });
});
