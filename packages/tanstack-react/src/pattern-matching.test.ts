import { describe, expect, it } from 'vitest';
import {
  getCanonicalPath,
  getLocalizedPath,
  matchRoutePattern,
  reconstructPath,
  type RoutePattern,
} from './pattern-matching';

// Sample patterns for testing
const samplePatterns: RoutePattern<'en' | 'es'>[] = [
  {
    canonical: ['about'],
    localized: { en: ['about'], es: ['sobre'] },
  },
  {
    canonical: ['blog'],
    localized: { en: ['blog'], es: ['articulos'] },
  },
  {
    canonical: ['blog', '$slug'],
    localized: { en: ['blog', '$slug'], es: ['articulos', '$slug'] },
  },
  {
    canonical: ['users', '$userId', 'posts', '$postId'],
    localized: {
      en: ['users', '$userId', 'posts', '$postId'],
      es: ['usuarios', '$userId', 'publicaciones', '$postId'],
    },
  },
];

const sampleRoutes = {
  en: { '/about': '/about', '/blog': '/blog' },
  es: { '/about': '/sobre', '/blog': '/articulos' },
};

const sampleReverseRoutes = {
  en: { '/about': '/about', '/blog': '/blog' },
  es: { '/sobre': '/about', '/articulos': '/blog' },
};

describe('matchRoutePattern', () => {
  it('returns null for empty patterns array', () => {
    const result = matchRoutePattern(['about'], [], 'en', false);
    expect(result).toBeNull();
  });

  it('matches static segments exactly', () => {
    const result = matchRoutePattern(['about'], samplePatterns, 'en', false);
    expect(result).not.toBeNull();
    expect(result?.pattern.canonical).toEqual(['about']);
    expect(result?.captured).toEqual({});
  });

  it('captures dynamic $param segments', () => {
    const result = matchRoutePattern(
      ['blog', 'hello-world'],
      samplePatterns,
      'en',
      false,
    );
    expect(result).not.toBeNull();
    expect(result?.pattern.canonical).toEqual(['blog', '$slug']);
    expect(result?.captured).toEqual({ $slug: 'hello-world' });
  });

  it('handles multiple dynamic segments', () => {
    const result = matchRoutePattern(
      ['users', '123', 'posts', '456'],
      samplePatterns,
      'en',
      false,
    );
    expect(result).not.toBeNull();
    expect(result?.captured).toEqual({ $userId: '123', $postId: '456' });
  });

  it('returns null when no pattern matches', () => {
    const result = matchRoutePattern(['contact'], samplePatterns, 'en', false);
    expect(result).toBeNull();
  });

  it('returns null when segment count does not match', () => {
    const result = matchRoutePattern(
      ['blog', 'slug', 'extra'],
      samplePatterns,
      'en',
      false,
    );
    expect(result).toBeNull();
  });

  it('matches against canonical patterns when useLocalized=false', () => {
    // 'blog' is the canonical segment, should match
    const result = matchRoutePattern(['blog'], samplePatterns, 'es', false);
    expect(result).not.toBeNull();
    expect(result?.pattern.canonical).toEqual(['blog']);
  });

  it('matches against localized patterns when useLocalized=true', () => {
    // 'articulos' is the Spanish localized segment for 'blog'
    const result = matchRoutePattern(['articulos'], samplePatterns, 'es', true);
    expect(result).not.toBeNull();
    expect(result?.pattern.canonical).toEqual(['blog']);
  });

  it('does not match localized segment when useLocalized=false', () => {
    // 'articulos' is Spanish, so should NOT match canonical
    const result = matchRoutePattern(
      ['articulos'],
      samplePatterns,
      'es',
      false,
    );
    expect(result).toBeNull();
  });

  it('does not match canonical segment when useLocalized=true', () => {
    // 'blog' is canonical, should NOT match localized Spanish patterns
    const result = matchRoutePattern(['blog'], samplePatterns, 'es', true);
    // 'blog' happens to also be the English localized pattern, but not Spanish
    // Spanish localized is 'articulos', so this should be null
    expect(result).toBeNull();
  });
});

describe('reconstructPath', () => {
  it('substitutes captured params into pattern', () => {
    const result = reconstructPath(['blog', '$slug'], { $slug: 'hello-world' });
    expect(result).toBe('/blog/hello-world');
  });

  it('preserves static segments unchanged', () => {
    const result = reconstructPath(['about'], {});
    expect(result).toBe('/about');
  });

  it('handles multiple dynamic segments', () => {
    const result = reconstructPath(['users', '$userId', 'posts', '$postId'], {
      $userId: '123',
      $postId: '456',
    });
    expect(result).toBe('/users/123/posts/456');
  });

  it('returns root path for empty segments', () => {
    const result = reconstructPath([], {});
    expect(result).toBe('/');
  });
});

describe('getLocalizedPath', () => {
  it('uses direct lookup for static routes', () => {
    const result = getLocalizedPath(
      '/about',
      'es',
      sampleRoutes,
      samplePatterns,
    );
    expect(result).toBe('/sobre');
  });

  it('returns root path unchanged', () => {
    const result = getLocalizedPath('/', 'es', sampleRoutes, samplePatterns);
    expect(result).toBe('/');
  });

  it('falls back to pattern matching for dynamic routes', () => {
    const result = getLocalizedPath(
      '/blog/hello-world',
      'es',
      sampleRoutes,
      samplePatterns,
    );
    expect(result).toBe('/articulos/hello-world');
  });

  it('returns original path when no match found', () => {
    const result = getLocalizedPath(
      '/unknown/path',
      'es',
      sampleRoutes,
      samplePatterns,
    );
    expect(result).toBe('/unknown/path');
  });

  it('handles complex dynamic routes', () => {
    const result = getLocalizedPath(
      '/users/42/posts/99',
      'es',
      sampleRoutes,
      samplePatterns,
    );
    expect(result).toBe('/usuarios/42/publicaciones/99');
  });
});

describe('getCanonicalPath', () => {
  it('uses direct lookup for static routes', () => {
    const result = getCanonicalPath(
      '/sobre',
      'es',
      sampleReverseRoutes,
      samplePatterns,
    );
    expect(result).toBe('/about');
  });

  it('returns root path unchanged', () => {
    const result = getCanonicalPath(
      '/',
      'es',
      sampleReverseRoutes,
      samplePatterns,
    );
    expect(result).toBe('/');
  });

  it('falls back to pattern matching for dynamic routes', () => {
    const result = getCanonicalPath(
      '/articulos/hello-world',
      'es',
      sampleReverseRoutes,
      samplePatterns,
    );
    expect(result).toBe('/blog/hello-world');
  });

  it('returns original path when no match found', () => {
    const result = getCanonicalPath(
      '/unknown/path',
      'es',
      sampleReverseRoutes,
      samplePatterns,
    );
    expect(result).toBe('/unknown/path');
  });

  it('handles complex dynamic routes', () => {
    const result = getCanonicalPath(
      '/usuarios/42/publicaciones/99',
      'es',
      sampleReverseRoutes,
      samplePatterns,
    );
    expect(result).toBe('/users/42/posts/99');
  });
});
