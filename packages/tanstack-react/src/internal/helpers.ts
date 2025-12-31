/**
 * Shared internal helpers for TanStack locale handling.
 *
 * These utilities are used by both client.ts and server.ts to avoid duplication.
 */

// ============================================================
// Constants
// ============================================================

export const DEFAULT_COOKIE_NAME = 'IDIOMI_LOCALE';
export const DEFAULT_DETECTION_ORDER: readonly ('cookie' | 'header')[] = [
  'cookie',
  'header',
];
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

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
 * @example
 * extractLocaleFromPath('/es/about', ['en', 'es']) // => 'es'
 * extractLocaleFromPath('/about', ['en', 'es']) // => undefined
 */
export function extractLocaleFromPath<L extends string>(
  pathname: string,
  locales: readonly L[],
): L | undefined {
  const segment = pathname.split('/')[1];
  if (segment && (locales as readonly string[]).includes(segment)) {
    return segment as L;
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

/**
 * Create a Set-Cookie header value for locale persistence.
 *
 * @example
 * createCookieHeader('IDIOMI_LOCALE', 'es')
 * // => 'IDIOMI_LOCALE=es;Path=/;Max-Age=31536000;SameSite=Lax'
 */
export function createCookieHeader(name: string, value: string): string {
  return `${name}=${value};Path=/;Max-Age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

// ============================================================
// Locale Matching Helpers
// ============================================================

/**
 * Match browser language preferences against supported locales.
 *
 * Uses simple prefix matching (e.g., 'en-US' matches 'en').
 * For BCP 47-compliant matching, use matchLocale from @idiomi/core/locale instead.
 *
 * @example
 * matchBrowserLocales(['en-US', 'es'], ['en', 'es', 'fr']) // => 'en'
 * matchBrowserLocales(['de-DE'], ['en', 'es']) // => undefined
 */
export function matchBrowserLocales<L extends string>(
  browserLocales: readonly string[],
  locales: readonly L[],
): L | undefined {
  for (const browserLang of browserLocales) {
    const normalized = browserLang.toLowerCase();

    // Exact match
    for (const locale of locales) {
      if (locale.toLowerCase() === normalized) return locale;
    }

    // Prefix match (e.g., 'en-US' matches 'en')
    const prefix = normalized.split('-')[0];
    for (const locale of locales) {
      if (locale.toLowerCase() === prefix) return locale;
      if (locale.toLowerCase().startsWith(prefix + '-')) return locale;
    }
  }
  return undefined;
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
