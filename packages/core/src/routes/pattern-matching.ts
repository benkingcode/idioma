/**
 * Framework-agnostic route pattern matching.
 *
 * This module provides a factory function that creates pattern matchers
 * for different framework syntaxes (Next.js, TanStack Router, etc.).
 *
 * @module
 */

/**
 * Route pattern structure for segment-level matching.
 */
export interface RoutePattern<L extends string = string> {
  /** Canonical path segments (e.g., ['users', '[userId]']) */
  canonical: readonly string[];
  /** Localized segments per locale */
  localized: Readonly<Record<L, readonly string[]>>;
}

/**
 * Result of a successful pattern match.
 */
export interface PatternMatchResult<L extends string = string> {
  /** The matched pattern */
  pattern: RoutePattern<L>;
  /** Captured dynamic segment values (e.g., { '[userId]': '123' }) */
  captured: Record<string, string>;
}

/**
 * Configuration for framework-specific segment detection.
 */
export interface PatternMatcherConfig {
  /**
   * Check if a segment is a dynamic param (captures a single segment).
   * Examples:
   * - Next.js: `[slug]` but not `[...slug]`
   * - TanStack: `$param`, `{$param}`, `{-$param}`
   */
  isDynamicParam: (segment: string) => boolean;

  /**
   * Check if a segment is a splat/catch-all (captures all remaining segments).
   * Examples:
   * - Next.js: `[...slug]` or `[[...optional]]`
   * - TanStack: `$`
   */
  isSplat: (segment: string) => boolean;
}

/**
 * Pattern matcher functions returned by the factory.
 */
export interface PatternMatcher<L extends string = string> {
  /**
   * Match URL segments against route patterns.
   */
  matchRoutePattern: (
    segments: string[],
    patterns: readonly RoutePattern<L>[],
    locale: L,
    useLocalized: boolean,
  ) => PatternMatchResult<L> | null;

  /**
   * Reconstruct a path from pattern segments, substituting captured values.
   */
  reconstructPath: (
    patternSegments: readonly string[],
    captured: Record<string, string>,
  ) => string;

  /**
   * Get localized path for a canonical path (direct lookup + pattern fallback).
   */
  getLocalizedPath: (
    canonicalPath: string,
    locale: L,
    routes: Record<L, Record<string, string>>,
    patterns: readonly RoutePattern<L>[],
  ) => string;

  /**
   * Get canonical path from a localized path (direct lookup + pattern fallback).
   */
  getCanonicalPath: (
    localizedPath: string,
    locale: L,
    reverseRoutes: Record<L, Record<string, string>>,
    patterns: readonly RoutePattern<L>[],
  ) => string;
}

/**
 * Create a pattern matcher with framework-specific segment detection.
 *
 * @example
 * ```ts
 * // Next.js pattern matcher
 * const nextMatcher = createPatternMatcher({
 *   isDynamicParam: (seg) => seg.startsWith('[') && !seg.startsWith('[...'),
 *   isSplat: (seg) => seg.startsWith('[...') || seg.startsWith('[[...'),
 * });
 *
 * // TanStack pattern matcher
 * const tanstackMatcher = createPatternMatcher({
 *   isDynamicParam: (seg) => seg.startsWith('$') || seg.startsWith('{$'),
 *   isSplat: (seg) => seg === '$',
 * });
 * ```
 */
export function createPatternMatcher<L extends string = string>(
  config: PatternMatcherConfig,
): PatternMatcher<L> {
  const { isDynamicParam, isSplat } = config;

  /**
   * Match URL segments against route patterns.
   *
   * @param segments - URL path segments to match (e.g., ['blog', 'hello-world'])
   * @param patterns - Array of route patterns to match against
   * @param locale - Current locale for localized pattern lookup
   * @param useLocalized - If true, match against localized patterns; if false, match canonical
   * @returns Match result with captured params, or null if no match
   */
  function matchRoutePattern(
    segments: string[],
    patterns: readonly RoutePattern<L>[],
    locale: L,
    useLocalized: boolean,
  ): PatternMatchResult<L> | null {
    // Try non-splat patterns first (more specific matches)
    // Then try splat patterns as fallback
    let splatMatch: PatternMatchResult<L> | null = null;

    for (const pattern of patterns) {
      const patternSegs = useLocalized
        ? pattern.localized[locale]
        : pattern.canonical;

      if (!patternSegs) continue;

      // Check if pattern has a splat (must be last segment)
      const hasSplat =
        patternSegs.length > 0 && isSplat(patternSegs[patternSegs.length - 1]!);

      // For splat patterns: URL must have at least (patternLength - 1) segments (splat can match 1+)
      // For non-splat: exact segment count match required
      if (hasSplat) {
        if (segments.length < patternSegs.length) continue;
      } else {
        if (patternSegs.length !== segments.length) continue;
      }

      const captured: Record<string, string> = {};
      let matches = true;

      for (let i = 0; i < patternSegs.length; i++) {
        const patternSeg = patternSegs[i]!;

        if (isSplat(patternSeg)) {
          // Splat - capture all remaining segments joined with /
          captured[patternSeg] = segments.slice(i).join('/');
          break; // Splat consumes rest, we're done
        }

        const urlSeg = segments[i]!;

        if (isDynamicParam(patternSeg)) {
          // Dynamic segment - capture the actual value
          captured[patternSeg] = urlSeg;
        } else if (patternSeg !== urlSeg) {
          // Static segment must match exactly
          matches = false;
          break;
        }
      }

      if (matches) {
        if (hasSplat) {
          // Save splat match but keep looking for a more specific non-splat match
          if (!splatMatch) {
            splatMatch = { pattern, captured };
          }
        } else {
          // Non-splat match is preferred, return immediately
          return { pattern, captured };
        }
      }
    }

    // Return splat match if no non-splat match was found
    return splatMatch;
  }

  /**
   * Reconstruct a path from pattern segments, substituting captured dynamic params.
   *
   * @param patternSegments - Pattern segments (may contain dynamic placeholders)
   * @param captured - Captured dynamic values from pattern matching
   * @returns Reconstructed path string (e.g., '/blog/hello-world')
   */
  function reconstructPath(
    patternSegments: readonly string[],
    captured: Record<string, string>,
  ): string {
    if (patternSegments.length === 0) return '/';

    const resultSegments: string[] = [];

    for (const seg of patternSegments) {
      if (isSplat(seg)) {
        // Splat value may contain /, push it directly (will be joined correctly)
        const splatValue = captured[seg];
        if (splatValue) {
          resultSegments.push(splatValue);
        }
      } else if (isDynamicParam(seg)) {
        // Dynamic param - substitute with captured value or keep original
        resultSegments.push(captured[seg] ?? seg);
      } else {
        // Static segment
        resultSegments.push(seg);
      }
    }

    return '/' + resultSegments.join('/');
  }

  /**
   * Get localized path for a canonical path (with dynamic param support).
   *
   * First attempts a direct lookup in the routes map.
   * Falls back to pattern matching for paths with dynamic segments.
   *
   * @param canonicalPath - Canonical path to localize (e.g., '/blog/hello')
   * @param locale - Target locale
   * @param routes - Static route map: canonical -> localized
   * @param patterns - Route patterns for dynamic segment matching
   * @returns Localized path, or original path if no translation found
   */
  function getLocalizedPath(
    canonicalPath: string,
    locale: L,
    routes: Record<L, Record<string, string>>,
    patterns: readonly RoutePattern<L>[],
  ): string {
    // Try direct lookup first (fastest for static routes)
    const direct = routes[locale]?.[canonicalPath];
    if (direct) return direct;

    // Handle root path
    if (canonicalPath === '/') return '/';

    // Parse path into segments and try pattern matching
    const segments = canonicalPath.split('/').filter(Boolean);
    const match = matchRoutePattern(segments, patterns, locale, false);

    if (match) {
      const localizedSegs = match.pattern.localized[locale];
      if (localizedSegs) {
        return reconstructPath(localizedSegs, match.captured);
      }
    }

    // No translation found, return original
    return canonicalPath;
  }

  /**
   * Get canonical path from a localized path (with dynamic param support).
   *
   * First attempts a direct lookup in the reverse routes map.
   * Falls back to pattern matching for paths with dynamic segments.
   *
   * @param localizedPath - Localized path to canonicalize (e.g., '/articulos/hola')
   * @param locale - Source locale of the path
   * @param reverseRoutes - Static route map: localized -> canonical
   * @param patterns - Route patterns for dynamic segment matching
   * @returns Canonical path, or original path if no translation found
   */
  function getCanonicalPath(
    localizedPath: string,
    locale: L,
    reverseRoutes: Record<L, Record<string, string>>,
    patterns: readonly RoutePattern<L>[],
  ): string {
    // Try direct lookup first (fastest for static routes)
    const direct = reverseRoutes[locale]?.[localizedPath];
    if (direct) return direct;

    // Handle root path
    if (localizedPath === '/') return '/';

    // Parse path into segments and try pattern matching
    const segments = localizedPath.split('/').filter(Boolean);
    const match = matchRoutePattern(segments, patterns, locale, true);

    if (match) {
      return reconstructPath(match.pattern.canonical, match.captured);
    }

    // No translation found, return original
    return localizedPath;
  }

  return {
    matchRoutePattern,
    reconstructPath,
    getLocalizedPath,
    getCanonicalPath,
  };
}
