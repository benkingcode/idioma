/**
 * SPA factories for TanStack Router locale handling.
 *
 * These factories create locale detection and URL rewriting functions
 * for single-page applications using TanStack Router.
 *
 * @example
 * ```typescript
 * // idiomi/index.ts
 * import { createLocaleLoader, createUrlRewriter } from '@idiomi/tanstack-react';
 * import { routes, reverseRoutes, routePatterns } from './.generated/routes';
 * import { locales, defaultLocale, prefixStrategy, detection } from './.generated/config';
 *
 * export const { localeLoader, detectClientLocale } = createLocaleLoader({
 *   locales, defaultLocale, prefixStrategy, detection,
 * });
 *
 * export const { delocalizeUrl, localizeUrl } = createUrlRewriter({
 *   locales, defaultLocale, prefixStrategy, routes, reverseRoutes, routePatterns,
 * });
 * ```
 */

import { redirect } from '@tanstack/react-router';

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

// ============================================================
// Locale Loader Types
// ============================================================

export interface LocaleLoaderConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly prefixStrategy: 'always' | 'as-needed' | 'never';
  readonly detection: DetectionConfig;
}

export interface LocaleLoaderResult<L extends string> {
  locale: L;
}

export interface LocaleLoaderApi<L extends string> {
  /** TanStack Router beforeLoad function for locale detection (sync or async) */
  localeLoader: (args: {
    location: LocationInfo;
  }) => LocaleLoaderResult<L> | Promise<LocaleLoaderResult<L>>;
  /** Low-level detection for manual use cases */
  detectClientLocale: () => L;
}

// ============================================================
// URL Rewriter Types
// ============================================================

/** Routes map: canonical path → localized path by locale */
export type RoutesMap<L extends string = string> = Readonly<
  Record<L, Record<string, string>>
>;

export interface UrlRewriterConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly prefixStrategy: 'always' | 'as-needed' | 'never';
  readonly routes: RoutesMap<L>;
  readonly reverseRoutes: RoutesMap<L>;
  readonly routePatterns: readonly RoutePattern<L>[];
}

export interface UrlRewriterApi {
  /** Transform localized URL to canonical for route matching (rewrite.input) */
  delocalizeUrl: (url: URL) => URL;
  /** Transform canonical URL to localized for display (rewrite.output) */
  localizeUrl: (url: URL) => URL;
}

export interface PrefixOnlyRewriterConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly prefixStrategy: 'always' | 'as-needed' | 'never';
}

export interface PrefixOnlyRewriterApi {
  /** Transform URL for display: strips default locale prefix when 'as-needed' */
  localizeUrl: (url: URL) => URL;
}

// ============================================================
// createLocaleLoader Factory
// ============================================================

/**
 * Creates locale detection functions for TanStack Router SPAs.
 *
 * @example
 * ```typescript
 * import { createLocaleLoader } from '@idiomi/tanstack-react';
 * import { locales, defaultLocale, prefixStrategy, detection } from './.generated/config';
 *
 * export const { localeLoader, detectClientLocale } = createLocaleLoader({
 *   locales, defaultLocale, prefixStrategy, detection,
 * });
 *
 * // Use in route definition:
 * export const Route = createRootRoute({
 *   beforeLoad: localeLoader,
 * });
 * ```
 */
export function createLocaleLoader<L extends string>(
  config: LocaleLoaderConfig<L>,
): LocaleLoaderApi<L> {
  const { locales, defaultLocale, prefixStrategy, detection } = config;

  // Internal helpers (closure-scoped)
  function extractLocaleFromPath(pathname: string): L | undefined {
    const segment = pathname.split('/')[1];
    if (segment && (locales as readonly string[]).includes(segment)) {
      return segment as L;
    }
    return undefined;
  }

  function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
    );
    return match?.[1];
  }

  function matchBrowserLocale(
    browserLocales: readonly string[],
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

  function detectClientLocale(): L {
    for (const source of detection.order) {
      if (source === 'cookie') {
        const cookie = getCookie(detection.cookieName);
        if (cookie && (locales as readonly string[]).includes(cookie)) {
          return cookie as L;
        }
      }
      if (source === 'header') {
        // 'header' = navigator.languages on client (skip during SSR)
        if (typeof navigator !== 'undefined' && navigator.languages?.length) {
          const matched = matchBrowserLocale(navigator.languages);
          if (matched) return matched;
        }
      }
    }
    return defaultLocale;
  }

  function localeLoader({
    location,
  }: {
    location: LocationInfo;
  }): LocaleLoaderResult<L> {
    const pathLocale = extractLocaleFromPath(location.pathname);

    // Strategy: 'never' - no URL prefixes, just detect
    if (prefixStrategy === 'never') {
      return { locale: pathLocale ?? detectClientLocale() };
    }

    // No locale in path - check if we need to redirect
    if (!pathLocale) {
      const detected = detectClientLocale();

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
      const pathWithoutLocale =
        location.pathname.slice(pathLocale.length + 1) || '/';
      throw redirect({
        to: `${pathWithoutLocale}${location.searchStr}${location.hash}` as string,
      });
    }

    // Non-default locale in path - use it
    return { locale: pathLocale };
  }

  return { localeLoader, detectClientLocale };
}

// ============================================================
// createUrlRewriter Factory (for localized paths)
// ============================================================

/**
 * Creates URL rewriting functions for TanStack Router with localized paths.
 *
 * @example
 * ```typescript
 * import { createUrlRewriter } from '@idiomi/tanstack-react';
 * import { routes, reverseRoutes, routePatterns } from './.generated/routes';
 * import { locales, defaultLocale, prefixStrategy } from './.generated/config';
 *
 * export const { delocalizeUrl, localizeUrl } = createUrlRewriter({
 *   routes, reverseRoutes, routePatterns, locales, defaultLocale, prefixStrategy,
 * });
 *
 * // Use in router:
 * const router = createRouter({
 *   routeTree,
 *   rewrite: {
 *     input: ({ url }) => delocalizeUrl(url),
 *     output: ({ url }) => localizeUrl(url),
 *   },
 * });
 * ```
 */
export function createUrlRewriter<L extends string>(
  config: UrlRewriterConfig<L>,
): UrlRewriterApi {
  const { locales, defaultLocale, prefixStrategy, routePatterns } = config;

  // Internal helpers
  function extractLocaleFromPath(pathname: string): L | undefined {
    const segment = pathname.split('/')[1];
    if (segment && (locales as readonly string[]).includes(segment)) {
      return segment as L;
    }
    return undefined;
  }

  function matchRoutePattern(
    segments: string[],
    locale: L,
    useLocalized: boolean,
  ): { pattern: RoutePattern<L>; captured: Record<string, string> } | null {
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
    const pathLocale = extractLocaleFromPath(url.pathname);

    // No locale in URL - return unchanged, let localeLoader handle redirect
    if (!pathLocale) return url;

    const pathWithoutLocale = url.pathname.slice(pathLocale.length + 1) || '/';

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
    const pathLocale = extractLocaleFromPath(url.pathname);
    // If no locale in URL, we can't localize
    if (!pathLocale) return url;

    const pathWithoutLocale = url.pathname.slice(pathLocale.length + 1) || '/';

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

    const segments = pathWithoutLocale.split('/').filter(Boolean);

    // Match against canonical patterns to find the route
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
// createPrefixOnlyRewriter Factory (for non-localized paths)
// ============================================================

/**
 * Creates a simple URL rewriter for prefix stripping only (no path translation).
 * Use when routing.localizedPaths is false.
 *
 * @example
 * ```typescript
 * import { createPrefixOnlyRewriter } from '@idiomi/tanstack-react';
 * import { locales, defaultLocale, prefixStrategy } from './.generated/config';
 *
 * export const { localizeUrl } = createPrefixOnlyRewriter({
 *   locales, defaultLocale, prefixStrategy,
 * });
 *
 * // Use in router:
 * const router = createRouter({
 *   routeTree,
 *   rewrite: {
 *     output: ({ url }) => localizeUrl(url),
 *   },
 * });
 * ```
 */
export function createPrefixOnlyRewriter<L extends string>(
  config: PrefixOnlyRewriterConfig<L>,
): PrefixOnlyRewriterApi {
  const { locales, defaultLocale, prefixStrategy } = config;

  function extractLocaleFromPath(pathname: string): L | undefined {
    const segment = pathname.split('/')[1];
    if (segment && (locales as readonly string[]).includes(segment)) {
      return segment as L;
    }
    return undefined;
  }

  function localizeUrl(url: URL): URL {
    const pathLocale = extractLocaleFromPath(url.pathname);
    if (!pathLocale) return url;

    // Strip prefix for default locale when 'as-needed'
    if (prefixStrategy === 'as-needed' && pathLocale === defaultLocale) {
      const newUrl = new URL(url);
      newUrl.pathname = url.pathname.slice(pathLocale.length + 1) || '/';
      return newUrl;
    }

    return url;
  }

  return { localizeUrl };
}
