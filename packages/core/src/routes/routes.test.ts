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
});

describe('generateRoutesModule', () => {
  it('generates valid JavaScript module', () => {
    const compiled = {
      routes: { en: { '/about': '/about' }, es: { '/about': '/sobre' } },
      reverseRoutes: { en: { '/about': '/about' }, es: { '/sobre': '/about' } },
    };

    const code = generateRoutesModule(compiled);

    expect(code).toContain('export const routes =');
    expect(code).toContain('export const reverseRoutes =');
    expect(code).toContain('export function getLocalizedPath');
    expect(code).toContain('export function getCanonicalPath');
    expect(code).toContain('Auto-generated by @idiomi/core');
    // segments should NOT be exported
    expect(code).not.toContain('export const segments');
  });
});

describe('ROUTE_CONTEXT_PREFIX', () => {
  it('is set to route:', () => {
    expect(ROUTE_CONTEXT_PREFIX).toBe('route:');
  });
});
