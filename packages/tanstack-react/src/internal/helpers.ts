/**
 * Shared internal helpers for TanStack locale handling.
 *
 * These utilities are used by both client.ts and server.ts to avoid duplication.
 */

// ============================================================
// Constants
// ============================================================

export const DEFAULT_COOKIE_NAME = 'IDIOMI_LOCALE';
export const DEFAULT_LOCALE_QUERY_PARAM = '_idiomi';
export const DEFAULT_DETECTION_ORDER: readonly ('cookie' | 'header')[] = [
  'cookie',
  'header',
];

/** Pattern to detect static files by extension */
export const STATIC_FILE_PATTERN = /\.[a-z0-9]+$/i;

/** Patterns that are always skipped (build assets, etc.) */
export const SKIP_PATH_PREFIXES = ['/_build', '/assets/', '/__'];

// ============================================================
// Path Helpers
// ============================================================

/**
 * Extract locale from URL path (first segment after /).
 *
 * Handles edge cases like double slashes (//es) by filtering empty segments.
 *
 * @example
 * extractLocaleFromPath('/es/about', ['en', 'es']) // => 'es'
 * extractLocaleFromPath('/about', ['en', 'es']) // => undefined
 * extractLocaleFromPath('//es/about', ['en', 'es']) // => 'es'
 */
export function extractLocaleFromPath<L extends string>(
  pathname: string,
  locales: readonly L[],
): L | undefined {
  // Filter out empty segments to handle double slashes (e.g., //es)
  const segments = pathname.split('/').filter(Boolean);
  const segment = segments[0];
  if (segment && (locales as readonly string[]).includes(segment)) {
    return segment as L;
  }
  return undefined;
}

/**
 * Extract locale from URL query parameter (set by edge middleware).
 *
 * This enables edge middleware (Vercel Middleware, Cloudflare Workers) to
 * pass their locale detection decision to the origin, ensuring cache
 * consistency.
 *
 * @example
 * extractLocaleFromQuery(url, ['en', 'es']) // url has ?_idiomi=es => 'es'
 * extractLocaleFromQuery(url, ['en', 'es']) // url has ?_idiomi=invalid => undefined
 */
export function extractLocaleFromQuery<L extends string>(
  url: URL,
  locales: readonly L[],
  paramName: string = DEFAULT_LOCALE_QUERY_PARAM,
): L | undefined {
  const queryLocale = url.searchParams.get(paramName);
  if (queryLocale && (locales as readonly string[]).includes(queryLocale)) {
    return queryLocale as L;
  }
  return undefined;
}

// ============================================================
// Cookie Helpers
// ============================================================

/**
 * Parse a cookie value from a cookie header string.
 *
 * @example
 * parseCookie('IDIOMI_LOCALE=es; theme=dark', 'IDIOMI_LOCALE') // => 'es'
 * parseCookie(null, 'IDIOMI_LOCALE') // => undefined
 */
export function parseCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1];
}

// ============================================================
// URL Helpers
// ============================================================

/**
 * Remove locale prefix from pathname.
 *
 * @example
 * stripLocalePrefix('/es/about', 'es') // => '/about'
 * stripLocalePrefix('/es', 'es') // => '/'
 */
export function stripLocalePrefix(pathname: string, locale: string): string {
  return pathname.slice(locale.length + 1) || '/';
}

/**
 * Add locale prefix to pathname.
 *
 * @example
 * addLocalePrefix('/about', 'es') // => '/es/about'
 * addLocalePrefix('/', 'es') // => '/es/'
 */
export function addLocalePrefix(pathname: string, locale: string): string {
  return `/${locale}${pathname}`;
}
