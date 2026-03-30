/**
 * Locale handling factories for TanStack Start SSR applications.
 *
 * ## SPA vs SSR
 *
 * This module is for **SSR** (TanStack Start). For plain TanStack Router (SPA),
 * use `@idiomi/tanstack-react` instead.
 *
 * **Why separate modules?**
 * - SSR: Redirects via `Response` objects in server entry
 * - SPA: Redirects via `throw redirect()` in `beforeLoad` hooks
 *
 * The underlying detection logic is shared — only the redirect mechanism differs.
 *
 * ## Exports
 *
 * - `createRequestHandler()` — Creates `handleLocale` for server entry
 * - `createIsomorphicLocaleDetector()` — Creates SSR-aware `detectLocale`
 *   (wraps TanStack Start's `createIsomorphicFn` for bundler-aware code splitting)
 *
 * ## Cookie Model (CDN-Cacheable)
 *
 * The server NEVER sets cookies. Cookies are only used for reading user preferences
 * (set client-side via locale picker). This keeps all responses cacheable by CDNs.
 *
 * @example
 * ```typescript
 * // idiomi/server.ts
 * import { createRequestHandler } from '@idiomi/tanstack-react/server';
 *
 * export const handleLocale = createRequestHandler({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 * });
 *
 * // src/server.ts
 * import { handleLocale } from './idiomi/server';
 *
 * const handler = defineHandlerCallback(async (ctx) => {
 *   const { locale, redirectResponse, localizedCtx } = handleLocale(ctx);
 *   if (redirectResponse) return redirectResponse;
 *   return defaultStreamHandler(localizedCtx);
 * });
 * ```
 */

import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import {
  detectLocaleFromBrowser,
  detectLocaleFromHeaders,
  type DetectionContext,
  type DetectionOptions,
} from './internal/detection.js';
import {
  DEFAULT_COOKIE_NAME,
  DEFAULT_DETECTION_ORDER,
  extractLocaleFromPath,
  extractLocaleFromQuery,
  SKIP_PATH_PREFIXES,
  STATIC_FILE_PATTERN,
  stripLocalePrefix,
} from './internal/helpers.js';
import {
  type BaseLocaleConfig,
  type PrefixStrategy,
} from './internal/types.js';

// ============================================================
// Types
// ============================================================

// Re-export types for external use
export type { BaseLocaleConfig, DetectionOptions, PrefixStrategy };

export interface LocaleDetectorConfig<
  L extends string = string,
> extends BaseLocaleConfig<L> {
  readonly detection?: DetectionOptions;
}

/**
 * Minimal router interface for route matching.
 * We use a loose type because TanStack Router's internal structure
 * varies across versions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouterLike = {
  /**
   * Match a pathname against the router's route tree.
   * Returns matched routes, route params, and the found route.
   */
  getMatchedRoutes: (pathname: string) => {
    routeParams: Record<string, string>;
    foundRoute: { id: string } | undefined;
    matchedRoutes: readonly unknown[];
  };
};

export interface RequestHandlerConfig<
  L extends string = string,
> extends BaseLocaleConfig<L> {
  readonly prefixStrategy: PrefixStrategy;
  readonly detection?: DetectionOptions;
  /**
   * Name of the locale param in localized routes (e.g., 'locale' for `{-$locale}`).
   * Used with `getRouter` to auto-detect which routes need locale handling.
   */
  readonly localeParamName?: string;
  /**
   * Factory function that returns a TanStack Router instance.
   * Used to check if routes have the locale param via `matchRoute()`.
   * When provided with `localeParamName`, non-localized routes will skip redirects.
   */
  readonly getRouter?: () => RouterLike;
}

export interface HandleLocaleResult<
  Ctx extends { request: Request; responseHeaders: Headers },
  L extends string = string,
> {
  /** Detected locale */
  locale: L;
  /** Redirect response (302). Return early if set. */
  redirectResponse?: Response;
  /** Modified context (request may be rewritten for internal routing) */
  localizedCtx: Ctx;
}

// ============================================================
// createIsomorphicLocaleDetector
// ============================================================

/**
 * Creates an SSR-aware locale detection function for TanStack Start.
 *
 * Uses TanStack Start's `createIsomorphicFn` to provide bundler-aware
 * server/client code splitting:
 * - Server: Uses cookie and Accept-Language header via getRequestHeaders()
 * - Client: Uses document.cookie and navigator.languages
 *
 * This function is designed for use in components or non-localized routes
 * where you need locale detection but not URL prefix handling.
 *
 * @example
 * ```typescript
 * import { createIsomorphicLocaleDetector } from '@idiomi/tanstack-react/server';
 *
 * export const detectLocale = createIsomorphicLocaleDetector({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   detection: { order: ['cookie', 'header'], cookieName: 'IDIOMI_LOCALE' },
 * });
 *
 * // In a component:
 * function RootComponent() {
 *   const locale = detectLocale();
 *   return <IdiomiProvider locale={locale}>...</IdiomiProvider>;
 * }
 * ```
 */
export function createIsomorphicLocaleDetector<L extends string>(
  config: LocaleDetectorConfig<L>,
): () => L {
  const { locales, defaultLocale, detection } = config;

  const ctx: DetectionContext<L> = {
    locales,
    defaultLocale,
    order: detection?.order ?? DEFAULT_DETECTION_ORDER,
    cookieName: detection?.cookieName ?? DEFAULT_COOKIE_NAME,
    algorithm: detection?.algorithm ?? 'best fit',
  };

  return createIsomorphicFn()
    .server(() => {
      const headers = getRequestHeaders();
      return detectLocaleFromHeaders<L>(
        headers.get('cookie'),
        headers.get('accept-language'),
        ctx,
      );
    })
    .client(() => detectLocaleFromBrowser<L>(ctx));
}

// ============================================================
// createRequestHandler
// ============================================================

/**
 * Check if a path should be skipped from locale handling.
 */
function shouldSkipPath(pathname: string): boolean {
  // Auto-skip static files
  if (STATIC_FILE_PATTERN.test(pathname)) return true;

  // Auto-skip build assets and internal paths
  for (const prefix of SKIP_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }

  return false;
}

/**
 * Detect locale from request headers (cookie and Accept-Language).
 * Uses the shared detectLocaleFromHeaders helper for consistency.
 */
function detectLocaleFromRequestInternal<L extends string>(
  request: Request,
  config: RequestHandlerConfig<L>,
): L {
  const { locales, defaultLocale, detection } = config;
  const ctx: DetectionContext<L> = {
    locales,
    defaultLocale,
    order: detection?.order ?? DEFAULT_DETECTION_ORDER,
    cookieName: detection?.cookieName ?? DEFAULT_COOKIE_NAME,
    algorithm: detection?.algorithm ?? 'best fit',
  };
  return detectLocaleFromHeaders(
    request.headers.get('cookie'),
    request.headers.get('accept-language'),
    ctx,
  );
}

/**
 * Creates a server entry handler for TanStack Start.
 *
 * Use this in your server entry (src/server.ts) to handle locale detection
 * and redirects before React rendering.
 *
 * Note: This handler does NOT set cookies. Cookies are only used for reading
 * user preferences (set client-side via locale picker). This keeps responses
 * cacheable by CDNs.
 *
 * @example
 * ```typescript
 * // idiomi/server.ts
 * import { createRequestHandler } from '@idiomi/tanstack-react/server';
 *
 * export const handleLocale = createRequestHandler({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 *   detection: { order: ['cookie', 'header'], cookieName: 'IDIOMI_LOCALE' },
 * });
 *
 * // src/server.ts
 * import { handleLocale } from './idiomi/server';
 *
 * const handler = defineHandlerCallback(async (ctx) => {
 *   const { locale, redirectResponse, localizedCtx } = handleLocale(ctx);
 *   if (redirectResponse) return redirectResponse;
 *   return defaultStreamHandler(localizedCtx);
 * });
 *
 * export default createServerEntry({ fetch: createStartHandler(handler) });
 * ```
 */
export function createRequestHandler<L extends string>(
  config: RequestHandlerConfig<L>,
): <Ctx extends { request: Request; responseHeaders: Headers }>(
  ctx: Ctx,
) => HandleLocaleResult<Ctx, L> {
  const { locales, defaultLocale, prefixStrategy, localeParamName, getRouter } =
    config;

  // Cache router lazily - TanStack Router isn't fully initialized until first request
  let router: RouterLike | undefined;
  function getRouterLazy(): RouterLike | undefined {
    if (!getRouter) return undefined;
    if (!router) {
      try {
        router = getRouter();
      } catch {
        // Router not initialized yet (first request during server startup)
        return undefined;
      }
    }
    return router;
  }

  /**
   * Regex to match locale param patterns in route IDs.
   *
   * Uses word boundaries to prevent false positives like $localeinfo matching $locale.
   * Matches:
   * - {-$locale} (optional bracket syntax)
   * - {$locale} (required bracket syntax)
   * - $locale (bare syntax)
   *
   * Bounded by: start of string, /, or end of string
   */
  const localeParamRegex = localeParamName
    ? new RegExp(
        `(^|/)` + // Start of string OR after slash
          `(\\{-?\\$${localeParamName}\\}|` + // Bracketed: {$locale} or {-$locale}
          `\\$${localeParamName})` + // OR bare: $locale
          `(/|$)`, // Followed by slash OR end of string
      )
    : null;

  /**
   * Check if a route is localized by using TanStack Router's getMatchedRoutes.
   *
   * This leverages the router's built-in matching logic instead of duplicating it
   * with custom regex patterns. The matched route's ID contains the original
   * route pattern (e.g., "/{-$locale}/about"), which we check for locale params.
   */
  function isLocalizedRoute(pathname: string): boolean {
    const currentRouter = getRouterLazy();
    if (!currentRouter || !localeParamRegex) return false;

    try {
      const { foundRoute } = currentRouter.getMatchedRoutes(pathname);
      if (!foundRoute) return false;

      // Check if the route's ID contains a locale param pattern with proper boundaries
      return localeParamRegex.test(foundRoute.id);
    } catch {
      return false;
    }
  }

  return (ctx) => {
    const url = new URL(ctx.request.url);
    const { pathname, search, hash } = url;

    // Skip locale handling for static files
    if (shouldSkipPath(pathname)) {
      return { locale: defaultLocale, localizedCtx: ctx };
    }

    // Extract locale from URL path
    const pathLocale = extractLocaleFromPath(pathname, locales);

    // Extract locale from query param (set by edge middleware for cache keying)
    const queryLocale = extractLocaleFromQuery(url, locales);

    // Detect locale from headers (cookie/Accept-Language)
    const detectedLocale = detectLocaleFromRequestInternal(ctx.request, config);

    // ============================================================
    // Non-localized routes: skip redirects, just detect locale
    // ============================================================
    if (!isLocalizedRoute(pathname)) {
      // Priority: path > query param (from edge) > cookie/header
      const locale = pathLocale ?? queryLocale ?? detectedLocale;
      return { locale, localizedCtx: ctx };
    }

    // ============================================================
    // Strategy: 'never' - never show prefix, always rewrite
    // ============================================================
    if (prefixStrategy === 'never') {
      // Priority: path > query param (from edge) > cookie/header
      const locale = pathLocale ?? queryLocale ?? detectedLocale;

      // Rewrite URL to include locale prefix for internal routing
      const normalizedPath = pathLocale
        ? pathname // already has locale
        : `/${locale}${pathname}`; // add locale prefix

      const needsRewrite = normalizedPath !== pathname;
      const localizedCtx = needsRewrite
        ? {
            ...ctx,
            request: new Request(
              `${url.origin}${normalizedPath}${search}${hash}`,
              ctx.request,
            ),
          }
        : ctx;

      return { locale, localizedCtx };
    }

    // ============================================================
    // Strategy: 'always' or 'as-needed'
    // ============================================================

    // No locale in path
    if (!pathLocale) {
      // Priority: query param (from edge) > cookie/header
      const locale = queryLocale ?? detectedLocale;

      // Redirect if: always prefix OR detected is non-default
      if (prefixStrategy === 'always' || locale !== defaultLocale) {
        const redirectUrl = `${url.origin}/${locale}${pathname}${search}${hash}`;
        const headers = new Headers();
        headers.set('Location', redirectUrl);
        return {
          locale,
          redirectResponse: new Response(null, { status: 302, headers }),
          localizedCtx: ctx,
        };
      }

      // 'as-needed' with default locale - no redirect needed
      return { locale, localizedCtx: ctx };
    }

    // Default locale in path with 'as-needed' - redirect to strip prefix
    if (prefixStrategy === 'as-needed' && pathLocale === defaultLocale) {
      const pathWithoutLocale = stripLocalePrefix(pathname, pathLocale);
      const redirectUrl = `${url.origin}${pathWithoutLocale}${search}${hash}`;
      const headers = new Headers();
      headers.set('Location', redirectUrl);
      return {
        locale: pathLocale,
        redirectResponse: new Response(null, { status: 302, headers }),
        localizedCtx: ctx,
      };
    }

    // Locale in path - use it
    return { locale: pathLocale, localizedCtx: ctx };
  };
}
