/**
 * Client-side factories for TanStack Router locale handling.
 *
 * These factories work in both SPA (Vite + TanStack Router) and SSR (TanStack Start)
 * contexts. They handle URL rewriting and locale detection for the browser.
 *
 * For server-side handling in TanStack Start, use @idiomi/tanstack-react/server.
 */

import { redirect } from '@tanstack/react-router';
import {
  DEFAULT_COOKIE_NAME,
  DEFAULT_DETECTION_ORDER,
  extractLocaleFromPath,
  matchBrowserLocales,
  parseCookie,
  stripLocalePrefix,
} from './internal/helpers.js';

// ============================================================
// Types
// ============================================================

/** Detection configuration for locale resolution */
export interface DetectionConfig {
  readonly order: readonly ('cookie' | 'header')[];
  readonly cookieName: string;
}

/** Route pattern for segment-level matching with dynamic params */
export interface RoutePattern<L extends string = string> {
  readonly canonical: readonly string[];
  readonly localized: Readonly<Record<L, readonly string[]>>;
}

/** Location info passed to localeLoader from TanStack Router */
export interface LocationInfo {
  readonly pathname: string;
  readonly searchStr: string;
  readonly hash: string;
}

/** Routes map: canonical path → localized path by locale */
export type RoutesMap<L extends string = string> = Readonly<
  Record<L, Record<string, string>>
>;

// ============================================================
// createLocaleLoader
// ============================================================

export interface LocaleLoaderConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly prefixStrategy: 'always' | 'as-needed' | 'never';
  readonly detection: DetectionConfig;
  /**
   * Name of the locale param in localized routes (e.g., 'locale' for `{-$locale}`).
   * When provided, routes without this param in their matched params will skip redirects.
   */
  readonly localeParamName?: string;
}

export interface LocaleLoaderResult<L extends string> {
  locale: L;
}

export interface LocaleLoaderApi<L extends string> {
  /** TanStack Router beforeLoad function for locale detection */
  localeLoader: (args: {
    location: LocationInfo;
    /** Route params from TanStack Router. Used to detect non-localized routes. */
    params?: Record<string, string>;
  }) => LocaleLoaderResult<L> | Promise<LocaleLoaderResult<L>>;
  /** Standalone locale detection for non-localized routes or components */
  detectLocale: () => L;
}

/**
 * Creates locale detection functions for TanStack Router.
 *
 * Use `localeLoader` in `beforeLoad` for routes with `/{-$locale}` param.
 * Use `detectLocale` for non-localized routes or components.
 *
 * @example
 * ```typescript
 * import { createLocaleLoader } from '@idiomi/tanstack-react';
 *
 * export const { localeLoader, detectLocale } = createLocaleLoader({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 *   detection: { order: ['cookie', 'header'], cookieName: 'IDIOMI_LOCALE' },
 * });
 *
 * // In route definition:
 * export const Route = createFileRoute('/{-$locale}')({
 *   beforeLoad: localeLoader,
 * });
 * ```
 */
export function createLocaleLoader<L extends string>(
  config: LocaleLoaderConfig<L>,
): LocaleLoaderApi<L> {
  const { locales, defaultLocale, prefixStrategy, detection, localeParamName } =
    config;

  function detectLocale(): L {
    for (const source of detection.order) {
      if (source === 'cookie') {
        const cookie = parseCookie(
          typeof document !== 'undefined' ? document.cookie : null,
          detection.cookieName,
        );
        if (cookie && (locales as readonly string[]).includes(cookie)) {
          return cookie as L;
        }
      }
      if (source === 'header') {
        // 'header' = navigator.languages on client
        if (typeof navigator !== 'undefined' && navigator.languages?.length) {
          const matched = matchBrowserLocales(navigator.languages, locales);
          if (matched) return matched;
        }
      }
    }
    return defaultLocale;
  }

  /**
   * Check if this is a localized route (has locale param).
   * Non-localized routes skip redirects.
   *
   * Note: For SPA, if localeLoader runs, we're on a localized route by definition
   * (user added beforeLoad: localeLoader). The param check is mainly for detecting
   * when the optional {-$locale} segment is present vs absent. When params is empty,
   * TanStack Router matched an optional segment route like /{-$locale} from URL /,
   * which IS localized - just without the prefix.
   */
  function isLocalizedRoute(params?: Record<string, string>): boolean {
    if (!localeParamName) return true; // Backward compatible
    if (!params) return true; // No params = assume localized
    // Empty params means optional segment route matched - still localized
    if (Object.keys(params).length === 0) return true;
    return localeParamName in params;
  }

  function localeLoader({
    location,
    params,
  }: {
    location: LocationInfo;
    params?: Record<string, string>;
  }): LocaleLoaderResult<L> {
    const pathLocale = extractLocaleFromPath(location.pathname, locales);

    // Non-localized routes: just detect locale, no redirects
    if (!isLocalizedRoute(params)) {
      return { locale: pathLocale ?? detectLocale() };
    }

    // Strategy: 'never' - no URL prefixes, just detect
    if (prefixStrategy === 'never') {
      return { locale: pathLocale ?? detectLocale() };
    }

    // No locale in path - check if we need to redirect
    if (!pathLocale) {
      const detected = detectLocale();

      // Redirect if: always prefix OR detected is non-default
      if (prefixStrategy === 'always' || detected !== defaultLocale) {
        throw redirect({
          to: `/${detected}${location.pathname}${location.searchStr}${location.hash}` as string,
        });
      }

      return { locale: detected };
    }

    // Default locale in path with 'as-needed' - redirect to strip prefix
    if (prefixStrategy === 'as-needed' && pathLocale === defaultLocale) {
      const pathWithoutLocale = stripLocalePrefix(
        location.pathname,
        pathLocale,
      );
      throw redirect({
        to: `${pathWithoutLocale}${location.searchStr}${location.hash}` as string,
      });
    }

    // Non-default locale in path - use it
    return { locale: pathLocale };
  }

  return { localeLoader, detectLocale };
}

// ============================================================
// createUrlHandler
// ============================================================

export interface UrlHandlerConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly prefixStrategy: 'always' | 'as-needed' | 'never';
  /** Routes for localized path translation. Omit for prefix-only mode. */
  readonly routes?: RoutesMap<L>;
  /** Reverse routes for delocalization. Required if routes is provided. */
  readonly reverseRoutes?: RoutesMap<L>;
  /** Route patterns for dynamic segment handling. Required if routes is provided. */
  readonly routePatterns?: readonly RoutePattern<L>[];
}

export interface UrlHandlerApi {
  /** Transform localized URL to canonical for route matching (rewrite.input) */
  delocalizeUrl: (url: URL) => URL;
  /** Transform canonical URL to localized for display (rewrite.output) */
  localizeUrl: (url: URL) => URL;
}

/**
 * Creates URL rewriting functions for TanStack Router's rewrite API.
 *
 * When `routes` is provided, handles full path translation (e.g., /es/sobre → /es/about).
 * When `routes` is omitted, handles prefix-only mode (just strips default locale prefix).
 *
 * @example
 * ```typescript
 * import { createUrlHandler } from '@idiomi/tanstack-react';
 *
 * // With localized paths
 * export const { delocalizeUrl, localizeUrl } = createUrlHandler({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 *   routes, reverseRoutes, routePatterns,
 * });
 *
 * // Prefix-only (no path translation)
 * export const { localizeUrl } = createUrlHandler({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 * });
 *
 * // In router:
 * const router = createRouter({
 *   routeTree,
 *   rewrite: {
 *     input: ({ url }) => delocalizeUrl(url),
 *     output: ({ url }) => localizeUrl(url),
 *   },
 * });
 * ```
 */
export function createUrlHandler<L extends string>(
  config: UrlHandlerConfig<L>,
): UrlHandlerApi {
  const { locales, defaultLocale, prefixStrategy, routes, routePatterns } =
    config;

  const hasLocalizedPaths = routes && routePatterns;

  function matchRoutePattern(
    segments: string[],
    locale: L,
    useLocalized: boolean,
  ): { pattern: RoutePattern<L>; captured: Record<string, string> } | null {
    if (!routePatterns) return null;

    for (const pattern of routePatterns) {
      const patternSegs = useLocalized
        ? pattern.localized[locale]
        : pattern.canonical;
      if (!patternSegs || patternSegs.length !== segments.length) continue;

      const captured: Record<string, string> = {};
      let matches = true;

      for (let i = 0; i < patternSegs.length; i++) {
        const patternSeg = patternSegs[i]!;
        const urlSeg = segments[i]!;

        if (patternSeg.startsWith('$')) {
          // Dynamic segment - capture the actual value
          captured[patternSeg] = urlSeg;
        } else if (patternSeg !== urlSeg) {
          // Static segment must match exactly
          matches = false;
          break;
        }
      }

      if (matches) {
        return { pattern, captured };
      }
    }
    return null;
  }

  function delocalizeUrl(url: URL): URL {
    // Prefix-only mode: no delocalization needed
    if (!hasLocalizedPaths) return url;

    const pathLocale = extractLocaleFromPath(url.pathname, locales);

    // No locale in URL - return unchanged
    if (!pathLocale) return url;

    const pathWithoutLocale = stripLocalePrefix(url.pathname, pathLocale);

    // Handle root path
    if (pathWithoutLocale === '/') return url;

    const segments = pathWithoutLocale.split('/').filter(Boolean);

    // Match against localized patterns to find the route
    const match = matchRoutePattern(segments, pathLocale, true);

    if (match) {
      // Build canonical path using pattern's canonical segments
      const canonicalPath =
        '/' +
        match.pattern.canonical
          .map((seg) => (seg.startsWith('$') ? match.captured[seg] : seg))
          .join('/');

      if (canonicalPath !== pathWithoutLocale) {
        const newUrl = new URL(url);
        // Keep locale prefix, translate the path segment
        newUrl.pathname = `/${pathLocale}${canonicalPath}`;
        return newUrl;
      }
    }

    return url;
  }

  function localizeUrl(url: URL): URL {
    const pathLocale = extractLocaleFromPath(url.pathname, locales);

    // If no locale in URL, we can't localize
    if (!pathLocale) return url;

    const pathWithoutLocale = stripLocalePrefix(url.pathname, pathLocale);

    // Handle prefix strategy: strip prefix for default locale when 'as-needed'
    const shouldStripPrefix =
      prefixStrategy === 'as-needed' && pathLocale === defaultLocale;

    // Handle root path
    if (pathWithoutLocale === '/') {
      if (shouldStripPrefix) {
        const newUrl = new URL(url);
        newUrl.pathname = '/';
        return newUrl;
      }
      return url;
    }

    // Prefix-only mode: just handle prefix stripping
    if (!hasLocalizedPaths) {
      if (shouldStripPrefix) {
        const newUrl = new URL(url);
        newUrl.pathname = pathWithoutLocale;
        return newUrl;
      }
      return url;
    }

    // Localized paths mode: translate the path
    const segments = pathWithoutLocale.split('/').filter(Boolean);
    const match = matchRoutePattern(segments, pathLocale, false);

    let localizedPath: string | undefined;

    if (match) {
      const localizedSegs = match.pattern.localized[pathLocale];
      if (localizedSegs) {
        // Build localized path, substituting captured dynamic values
        localizedPath =
          '/' +
          localizedSegs
            .map((seg) => (seg.startsWith('$') ? match.captured[seg] : seg))
            .join('/');
      }
    }

    // Default to original path if no translation found
    if (!localizedPath) localizedPath = pathWithoutLocale;

    // Build final URL
    const newUrl = new URL(url);
    if (shouldStripPrefix) {
      // No prefix for default locale with 'as-needed' strategy
      newUrl.pathname = localizedPath;
    } else if (localizedPath !== pathWithoutLocale) {
      // Keep prefix, apply path translation
      newUrl.pathname = `/${pathLocale}${localizedPath}`;
    } else {
      // No changes needed
      return url;
    }
    return newUrl;
  }

  return { delocalizeUrl, localizeUrl };
}

// ============================================================
// Client-side locale preference
// ============================================================

export interface SetLocalePreferenceConfig {
  /** Cookie name for storing locale preference */
  readonly cookieName?: string;
  /** Max age in seconds (default: 1 year) */
  readonly maxAge?: number;
}

/**
 * Sets the user's locale preference cookie (client-side only).
 *
 * Call this from your locale picker when the user explicitly chooses a language.
 * The server reads this cookie on subsequent requests to honor the preference.
 *
 * @example
 * ```typescript
 * import { setLocalePreference } from '@idiomi/tanstack-react';
 *
 * function LocalePicker() {
 *   const handleChange = (locale: string) => {
 *     setLocalePreference(locale);
 *     // Navigate to the new locale
 *     window.location.href = `/${locale}/`;
 *   };
 *
 *   return (
 *     <select onChange={(e) => handleChange(e.target.value)}>
 *       <option value="en">English</option>
 *       <option value="es">Español</option>
 *     </select>
 *   );
 * }
 * ```
 */
export function setLocalePreference(
  locale: string,
  config?: SetLocalePreferenceConfig,
): void {
  if (typeof document === 'undefined') {
    console.warn('setLocalePreference can only be called on the client');
    return;
  }

  const cookieName = config?.cookieName ?? DEFAULT_COOKIE_NAME;
  const maxAge = config?.maxAge ?? 60 * 60 * 24 * 365; // 1 year

  document.cookie = `${cookieName}=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

/**
 * Clears the user's locale preference cookie.
 *
 * Call this to reset to automatic locale detection (Accept-Language header).
 *
 * @example
 * ```typescript
 * import { clearLocalePreference } from '@idiomi/tanstack-react';
 *
 * function ResetLocale() {
 *   return (
 *     <button onClick={() => clearLocalePreference()}>
 *       Use browser language
 *     </button>
 *   );
 * }
 * ```
 */
export function clearLocalePreference(
  config?: Pick<SetLocalePreferenceConfig, 'cookieName'>,
): void {
  if (typeof document === 'undefined') {
    console.warn('clearLocalePreference can only be called on the client');
    return;
  }

  const cookieName = config?.cookieName ?? DEFAULT_COOKIE_NAME;

  // Set Max-Age to 0 to delete the cookie
  document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

// ============================================================
// Re-exports for convenience
// ============================================================

export {
  DEFAULT_COOKIE_NAME,
  DEFAULT_DETECTION_ORDER,
} from './internal/helpers.js';
