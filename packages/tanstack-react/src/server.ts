/**
 * Server-side factories for TanStack Start locale handling.
 *
 * These factories provide SSR-aware locale detection and server entry
 * middleware for TanStack Start applications.
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
 * ```
 */

import { matchLocale } from '@idiomi/core/locale';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import {
  detectLocaleFromBrowser,
  detectLocaleFromHeaders,
  type DetectionContext,
} from './internal/detection.js';
import {
  createCookieHeader,
  DEFAULT_COOKIE_NAME,
  DEFAULT_DETECTION_ORDER,
  extractLocaleFromPath,
  extractLocaleFromQuery,
  parseCookie,
  SKIP_PATH_PREFIXES,
  STATIC_FILE_PATTERN,
  stripLocalePrefix,
} from './internal/helpers.js';

// ============================================================
// Types
// ============================================================

export interface DetectionConfig {
  readonly order?: readonly ('cookie' | 'header')[];
  readonly cookieName?: string;
  readonly algorithm?: 'lookup' | 'best fit';
}

export interface LocaleDetectorConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly detection?: DetectionConfig;
}

export interface RequestHandlerConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly prefixStrategy: 'always' | 'as-needed' | 'never';
  readonly detection?: DetectionConfig;
}

export interface HandleLocaleResult<
  Ctx extends { request: Request; responseHeaders: Headers },
  L extends string = string,
> {
  /** Detected locale */
  locale: L;
  /** Redirect response (302). Return early if set. */
  redirectResponse?: Response;
  /** Modified context (request rewritten, cookie on responseHeaders) */
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
 */
function detectLocaleFromRequest<L extends string>(
  request: Request,
  config: RequestHandlerConfig<L>,
): L {
  const { locales, defaultLocale, detection } = config;
  const cookieName = detection?.cookieName ?? DEFAULT_COOKIE_NAME;
  const order = detection?.order ?? DEFAULT_DETECTION_ORDER;
  const algorithm = detection?.algorithm ?? 'best fit';

  const cookieHeader = request.headers.get('cookie');
  const acceptLanguage = request.headers.get('accept-language');

  for (const source of order) {
    if (source === 'cookie') {
      const cookie = parseCookie(cookieHeader, cookieName);
      if (cookie && (locales as readonly string[]).includes(cookie)) {
        return cookie as L;
      }
    }
    if (source === 'header' && acceptLanguage) {
      const matched = matchLocale(acceptLanguage, {
        locales: locales as unknown as string[],
        defaultLocale,
        algorithm,
      });
      if (matched && (locales as readonly string[]).includes(matched)) {
        return matched as L;
      }
    }
  }

  return defaultLocale;
}

/**
 * Creates a server entry handler for TanStack Start.
 *
 * Use this in your server entry (src/server.ts) to handle locale detection,
 * redirects, and cookie syncing before React rendering.
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
  const { locales, defaultLocale, prefixStrategy, detection } = config;
  const cookieName = detection?.cookieName ?? DEFAULT_COOKIE_NAME;

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
    const detectedLocale = detectLocaleFromRequest(ctx.request, config);

    // Check if cookie needs syncing
    const cookieHeader = ctx.request.headers.get('cookie');
    const existingCookie = parseCookie(cookieHeader, cookieName);

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

      // Sync cookie if needed
      const needsCookieSync = !existingCookie || existingCookie !== locale;
      if (needsCookieSync) {
        ctx.responseHeaders.append(
          'Set-Cookie',
          createCookieHeader(cookieName, locale),
        );
      }

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
    // Sync cookie if different from current
    if (existingCookie !== pathLocale) {
      ctx.responseHeaders.append(
        'Set-Cookie',
        createCookieHeader(cookieName, pathLocale),
      );
    }

    return { locale: pathLocale, localizedCtx: ctx };
  };
}
