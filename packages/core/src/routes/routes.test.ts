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
    it('identifies dynamic segments', () => {
      expect(isDynamicSegment('[slug]')).toBe(true);
      expect(isDynamicSegment('[...slug]')).toBe(true);
      expect(isDynamicSegment('[[...slug]]')).toBe(true);
      expect(isDynamicSegment('[id]')).toBe(true);
    });

    it('identifies static segments', () => {
      expect(isDynamicSegment('about')).toBe(false);
      expect(isDynamicSegment('blog')).toBe(false);
      expect(isDynamicSegment('contact-us')).toBe(false);
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
    it('filters out dynamic segments and groups', () => {
      const segments = ['(marketing)', 'blog', '[slug]', 'comments'];
      expect(getTranslatableSegments(segments)).toEqual(['blog', 'comments']);
    });

    it('handles empty array', () => {
      expect(getTranslatableSegments([])).toEqual([]);
    });

    it('handles all dynamic/group segments', () => {
      const segments = ['(auth)', '[userId]', '[[...params]]'];
      expect(getTranslatableSegments(segments)).toEqual([]);
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

    const compiled = compileRoutes(routes, messages, ['en', 'es']);

    // Check segment translations
    expect(compiled.segments.en).toEqual({ about: 'about', blog: 'blog' });
    expect(compiled.segments.es).toEqual({ about: 'sobre', blog: 'articulos' });

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

    const compiled = compileRoutes(routes, messages, ['en', 'es']);

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

    const compiled = compileRoutes(routes, messages, ['en', 'fr']);

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

    const compiled = compileRoutes(routes, messages, ['en']);

    expect(compiled.segments.en).toEqual({ about: 'about' });
    expect(Object.keys(compiled.segments.en)).toHaveLength(1);
  });
});

describe('generateRoutesModule', () => {
  it('generates valid JavaScript module', () => {
    const compiled = {
      segments: { en: { about: 'about' }, es: { about: 'sobre' } },
      routes: { en: { '/about': '/about' }, es: { '/about': '/sobre' } },
      reverseRoutes: { en: { '/about': '/about' }, es: { '/sobre': '/about' } },
    };

    const code = generateRoutesModule(compiled);

    expect(code).toContain('export const segments =');
    expect(code).toContain('export const routes =');
    expect(code).toContain('export const reverseRoutes =');
    expect(code).toContain('export function getLocalizedPath');
    expect(code).toContain('export function getCanonicalPath');
    expect(code).toContain('Auto-generated by @idioma/core');
  });
});

describe('ROUTE_CONTEXT_PREFIX', () => {
  it('is set to route:', () => {
    expect(ROUTE_CONTEXT_PREFIX).toBe('route:');
  });
});
