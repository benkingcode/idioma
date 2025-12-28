/**
 * Route extraction and compilation types.
 *
 * Routes are extracted as individual path segments (not full paths) to:
 * 1. Keep translations simple for translators (just words like "about", "blog")
 * 2. Prevent accidental breakage of slashes or bracket syntax
 * 3. Never expose dynamic segments [param] to translation
 */

/** A single extracted route from the filesystem */
export interface ExtractedRoute {
  /** Canonical path (e.g., '/about', '/blog/[slug]') */
  path: string;
  /** Source file that defines this route */
  source: string;
  /** Type of route */
  type: 'page' | 'layout' | 'route';
  /** Path segments (e.g., ['about'] or ['blog', '[slug]']) */
  segments: string[];
}

/** A translatable route segment extracted to PO files */
export interface RouteSegment {
  /** The segment text (e.g., 'about', 'blog') */
  segment: string;
  /** Source file reference */
  source: string;
  /** Generated message key (murmurhash) */
  key: string;
}

/** Framework type for route extraction */
export type Framework = 'nextjs-app' | 'nextjs-pages' | 'tanstack';

/** Options for route extraction */
export interface ExtractRoutesOptions {
  /** Project root directory */
  projectRoot: string;
  /** Patterns to exclude (e.g., ['api/**', '_next/**']) */
  exclude?: string[];
}

/** Compiled route maps for runtime use */
export interface CompiledRoutes {
  /** Segment translations by locale: { en: { about: 'about' }, es: { about: 'sobre' } } */
  segments: Record<string, Record<string, string>>;
  /** Full path maps: { en: { '/about': '/about' }, es: { '/about': '/sobre' } } */
  routes: Record<string, Record<string, string>>;
  /** Reverse maps for URL matching: { es: { '/sobre': '/about' } } */
  reverseRoutes: Record<string, Record<string, string>>;
}

/**
 * Check if a segment is dynamic (should not be translated).
 * Dynamic segments: [param], [...slug], [[...optional]]
 */
export function isDynamicSegment(segment: string): boolean {
  return segment.startsWith('[') && segment.endsWith(']');
}

/**
 * Check if a segment is a route group (should be skipped).
 * Route groups: (marketing), (auth)
 */
export function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

/**
 * Get translatable segments from a path.
 * Filters out dynamic segments and route groups.
 */
export function getTranslatableSegments(segments: string[]): string[] {
  return segments.filter(
    (seg) => !isDynamicSegment(seg) && !isRouteGroup(seg) && seg.length > 0,
  );
}
