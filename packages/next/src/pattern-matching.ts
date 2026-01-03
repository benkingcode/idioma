/**
 * Next.js-specific route pattern matching utilities.
 *
 * These functions handle matching URL segments against route patterns
 * with dynamic segment support using Next.js App Router syntax:
 * - `[param]` - single dynamic segment
 * - `[...slug]` - catch-all segment
 * - `[[...optional]]` - optional catch-all segment
 *
 * @module
 */

// Import from dedicated subpath to avoid pulling in Node.js-only extraction code
import { createPatternMatcher } from '@idiomi/core/routes/pattern-matching';

/**
 * Re-export types from core for convenience.
 */
export type {
  PatternMatcher,
  PatternMatcherConfig,
  PatternMatchResult,
  RoutePattern,
} from '@idiomi/core/routes/pattern-matching';

/**
 * Next.js pattern matcher configured for App Router dynamic segment syntax.
 *
 * Dynamic segment detection:
 * - `[param]` - single dynamic segment (NOT `[...` or `[[...`)
 * - `[...slug]` - catch-all segment
 * - `[[...optional]]` - optional catch-all segment
 */
const matcher = createPatternMatcher({
  /**
   * Check if segment is a single dynamic param (not catch-all).
   * Matches: `[slug]`, `[id]`, `[userId]`
   * Does NOT match: `[...slug]`, `[[...optional]]`
   */
  isDynamicParam: (seg: string) =>
    seg.startsWith('[') && !seg.startsWith('[...') && !seg.startsWith('[[...'),

  /**
   * Check if segment is a catch-all (splat).
   * Matches: `[...slug]`, `[[...optional]]`
   */
  isSplat: (seg: string) => seg.startsWith('[...') || seg.startsWith('[[...'),
});

/**
 * Match URL segments against route patterns.
 *
 * @see {@link createPatternMatcher} for algorithm details
 */
export const matchRoutePattern = matcher.matchRoutePattern;

/**
 * Reconstruct a path from pattern segments, substituting captured values.
 *
 * @see {@link createPatternMatcher} for algorithm details
 */
export const reconstructPath = matcher.reconstructPath;

/**
 * Get localized path for a canonical path (direct lookup + pattern fallback).
 *
 * @see {@link createPatternMatcher} for algorithm details
 */
export const getLocalizedPath = matcher.getLocalizedPath;

/**
 * Get canonical path from a localized path (direct lookup + pattern fallback).
 *
 * @see {@link createPatternMatcher} for algorithm details
 */
export const getCanonicalPath = matcher.getCanonicalPath;
