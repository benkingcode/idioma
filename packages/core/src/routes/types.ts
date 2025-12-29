/**
 * Route extraction and compilation types.
 *
 * Routes are extracted as individual path segments (not full paths) to:
 * 1. Keep translations simple for translators (just words like "about", "blog")
 * 2. Prevent accidental breakage of slashes or bracket syntax
 * 3. Never expose dynamic segments to translation
 *
 * Dynamic segment syntax varies by framework:
 * - Next.js: [param], [...slug], [[...optional]]
 * - TanStack: $param, $[param], {$param}, {-$param}, $ (splat)
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
export type Framework = 'next-app' | 'next-pages' | 'tanstack';

/** Options for route extraction */
export interface ExtractRoutesOptions {
  /** Project root directory */
  projectRoot: string;
  /** Patterns to exclude (e.g., ['api/**', '_next/**']) */
  exclude?: string[];
}

/** Compiled route maps for runtime use */
export interface CompiledRoutes {
  /** Full path maps: { en: { '/about': '/about' }, es: { '/about': '/sobre' } } */
  routes: Record<string, Record<string, string>>;
  /** Reverse maps for URL matching: { es: { '/sobre': '/about' } } */
  reverseRoutes: Record<string, Record<string, string>>;
}

/**
 * Check if a segment is dynamic in Next.js (should not be translated).
 *
 * Next.js syntax: [param], [...slug], [[...optional]]
 */
export function isNextJsDynamicSegment(segment: string): boolean {
  return segment.startsWith('[') && segment.endsWith(']');
}

/**
 * Check if a segment is dynamic in TanStack Router (should not be translated).
 *
 * TanStack syntax: $param, $[param], {$param}, {-$param}, $ (splat)
 */
export function isTanStackDynamicSegment(segment: string): boolean {
  // $param, $[param], $ (splat)
  if (segment.startsWith('$')) {
    return true;
  }

  // {$param}, {-$param} (params with special chars or optional)
  if (segment.startsWith('{') && segment.includes('$')) {
    return true;
  }

  return false;
}

/**
 * Check if a segment is dynamic for the given framework.
 */
export function isDynamicSegment(
  segment: string,
  framework: Framework,
): boolean {
  if (framework === 'tanstack') {
    return isTanStackDynamicSegment(segment);
  }
  return isNextJsDynamicSegment(segment);
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
export function getTranslatableSegments(
  segments: string[],
  framework: Framework,
): string[] {
  return segments.filter(
    (seg) =>
      !isDynamicSegment(seg, framework) && !isRouteGroup(seg) && seg.length > 0,
  );
}
