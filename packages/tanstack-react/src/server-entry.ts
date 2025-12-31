/**
 * Server entry helpers for TanStack Start locale handling.
 *
 * This module provides functions for use inside `createServerEntry` to handle
 * locale detection, URL rewriting, and redirects BEFORE routing.
 *
 * Unlike the SPA `localeLoader` (which runs in `beforeLoad` after routing), these functions
 * run at the server entry level and can rewrite the request URL.
 *
 * @example
 * ```typescript
 * // src/server.ts
 * import {
 *   createStartHandler,
 *   defaultStreamHandler,
 *   defineHandlerCallback,
 * } from '@tanstack/react-start/server';
 * import { createServerEntry } from '@tanstack/react-start/server-entry';
 * import { handleLocale } from './idiomi';
 *
 * const customHandler = defineHandlerCallback(async (ctx) => {
 *   const { locale, redirectResponse, localizedCtx } = handleLocale(ctx);
 *   if (redirectResponse) return redirectResponse;
 *   // Custom logic here with locale
 *   return defaultStreamHandler(localizedCtx);
 * });
 *
 * export default createServerEntry({ fetch: createStartHandler(customHandler) });
 * ```
 */

import { matchLocale } from '@idiomi/core/locale';
import picomatch from 'picomatch';

// ============================================================
// Types
// ============================================================

export interface LocaleServerEntryConfig<L extends string = string> {
  /** Supported locales */
  locales: readonly L[];
  /** Default/fallback locale */
  defaultLocale: L;
  /** URL prefix strategy */
  prefixStrategy: 'always' | 'as-needed' | 'never';
  /** Locale detection configuration */
  detection?: {
    /** Cookie name for storing locale preference */
    cookieName?: string;
    /** Order of detection sources */
    order?: readonly ('cookie' | 'header')[];
    /** Matching algorithm for Accept-Language */
    algorithm?: 'lookup' | 'best fit';
  };
  /**
   * Paths to skip locale handling. Supports two formats:
   * - Glob array: ['/api/*', '/dashboard/**', '/_*']
   * - Regex string: '^/(api|_|dashboard)'
   *
   * Static files (.js, .css, .ico, etc.) are always skipped automatically.
   */
  ignorePaths?: string[] | string;
}

export interface LocaleResult<L extends string = string> {
  /** Detected locale */
  locale: L;
  /** Rewritten URL (only set if URL was rewritten internally) */
  rewrittenUrl?: string;
  /** Redirect URL (only set if redirect is needed) */
  redirectUrl?: string;
  /** Set-Cookie header value (only set if cookie sync is needed) */
  setCookie?: string;
}

// ============================================================
// Internal Helpers
// ============================================================

const DEFAULT_COOKIE_NAME = 'IDIOMI_LOCALE';
const DEFAULT_DETECTION_ORDER: Array<'cookie' | 'header'> = [
  'cookie',
  'header',
];
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Pattern to detect static files by extension.
 * Matches paths ending with common file extensions.
 */
const STATIC_FILE_PATTERN = /\.[a-z0-9]+$/i;

/**
 * Patterns that are always skipped (build assets, etc.)
 */
const SKIP_PATH_PREFIXES = ['/_build', '/assets/', '/__'];

/**
 * Extract locale from URL path (first segment).
 */
function extractLocaleFromPath<L extends string>(
  pathname: string,
  locales: readonly L[],
): L | undefined {
  const segment = pathname.split('/')[1];
  if (segment && (locales as readonly string[]).includes(segment)) {
    return segment as L;
  }
  return undefined;
}

/**
 * Get cookie value from cookie header string.
 */
function getCookieValue(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1];
}

/**
 * Create Set-Cookie header value.
 */
function createCookieHeader(name: string, value: string): string {
  return `${name}=${value};Path=/;Max-Age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

/**
 * Check if a path should be skipped from locale handling.
 */
function shouldSkipPath<L extends string>(
  pathname: string,
  config: LocaleServerEntryConfig<L>,
): boolean {
  // 1. Auto-skip static files
  if (STATIC_FILE_PATTERN.test(pathname)) return true;

  // 2. Auto-skip build assets and internal paths
  for (const prefix of SKIP_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }

  // 3. User-configured ignorePaths
  if (!config.ignorePaths) return false;

  if (typeof config.ignorePaths === 'string') {
    return new RegExp(config.ignorePaths).test(pathname);
  }
  // Array of globs - use picomatch
  return picomatch.isMatch(pathname, config.ignorePaths);
}

/**
 * Detect locale from request headers.
 */
function detectLocaleFromRequest<L extends string>(
  request: Request,
  config: LocaleServerEntryConfig<L>,
): L {
  const { locales, defaultLocale, detection } = config;
  const cookieName = detection?.cookieName ?? DEFAULT_COOKIE_NAME;
  const order = detection?.order ?? DEFAULT_DETECTION_ORDER;
  const algorithm = detection?.algorithm ?? 'best fit';

  const cookieHeader = request.headers.get('cookie');
  const acceptLanguage = request.headers.get('accept-language');

  for (const source of order) {
    if (source === 'cookie') {
      const cookie = getCookieValue(cookieHeader, cookieName);
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

// ============================================================
// Main API
// ============================================================

/**
 * Handle locale detection and URL routing for a request.
 *
 * This function is designed to be used inside `createServerEntry({ fetch })`.
 * It detects the locale, determines if a redirect or rewrite is needed,
 * and returns the result.
 *
 * @param request - The incoming Request object
 * @param config - Locale handling configuration
 * @returns LocaleResult with locale, optional rewrittenUrl/redirectUrl, and optional setCookie
 */
export function handleLocaleRequest<L extends string>(
  request: Request,
  config: LocaleServerEntryConfig<L>,
): LocaleResult<L> {
  const url = new URL(request.url);
  const { pathname, search, hash } = url;
  const { locales, defaultLocale, prefixStrategy, detection } = config;
  const cookieName = detection?.cookieName ?? DEFAULT_COOKIE_NAME;

  // Skip locale handling for static files and ignored paths
  if (shouldSkipPath(pathname, config)) {
    return { locale: defaultLocale };
  }

  // Extract locale from URL path
  const pathLocale = extractLocaleFromPath(pathname, locales);

  // Detect locale from headers
  const detectedLocale = detectLocaleFromRequest(request, config);

  // Determine if cookie needs syncing
  const cookieHeader = request.headers.get('cookie');
  const existingCookie = getCookieValue(cookieHeader, cookieName);

  // ============================================================
  // Strategy: 'never' - never show prefix, always rewrite
  // ============================================================
  if (prefixStrategy === 'never') {
    const locale = pathLocale ?? detectedLocale;

    // Rewrite URL to include locale prefix for internal routing
    // (even if there's already a locale in path, normalize it)
    const normalizedPath = pathLocale
      ? pathname // already has locale
      : `/${locale}${pathname}`; // add locale prefix

    const rewrittenUrl =
      normalizedPath !== pathname
        ? `${url.origin}${normalizedPath}${search}${hash}`
        : undefined;

    // Sync cookie if detected from header (not from cookie)
    const needsCookieSync = !existingCookie || existingCookie !== locale;
    const setCookie = needsCookieSync
      ? createCookieHeader(cookieName, locale)
      : undefined;

    return { locale, rewrittenUrl, setCookie };
  }

  // ============================================================
  // Strategy: 'always' or 'as-needed'
  // ============================================================

  // No locale in path
  if (!pathLocale) {
    const locale = detectedLocale;

    // For 'always': redirect to add prefix
    // For 'as-needed': redirect if non-default locale
    if (prefixStrategy === 'always' || locale !== defaultLocale) {
      const redirectUrl = `${url.origin}/${locale}${pathname}${search}${hash}`;
      return { locale, redirectUrl };
    }

    // 'as-needed' with default locale - no redirect needed
    return { locale };
  }

  // Default locale in path with 'as-needed' - redirect to strip prefix
  if (prefixStrategy === 'as-needed' && pathLocale === defaultLocale) {
    const pathWithoutLocale = pathname.slice(pathLocale.length + 1) || '/';
    const redirectUrl = `${url.origin}${pathWithoutLocale}${search}${hash}`;
    return { locale: pathLocale, redirectUrl };
  }

  // Locale in path - use it
  // Sync cookie if different from current
  const needsCookieSync = existingCookie !== pathLocale;
  const setCookie = needsCookieSync
    ? createCookieHeader(cookieName, pathLocale)
    : undefined;

  return { locale: pathLocale, setCookie };
}

// ============================================================
// Simplified Handler API
// ============================================================

/**
 * Result of the handleLocale function.
 *
 * This type represents the output of processing locale detection in the
 * server entry handler. It provides a cleaner API than the raw `LocaleResult`
 * by returning ready-to-use values.
 */
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

/**
 * Create a locale handler for use in server entry.
 *
 * This factory takes locale configuration and returns a function that
 * processes the TanStack handler context, returning a `HandleLocaleResult`
 * with destructurable properties.
 *
 * @example
 * ```typescript
 * // idiomi/index.ts (auto-generated)
 * export const handleLocale = createHandleLocale<Locale>({
 *   locales, defaultLocale, prefixStrategy, detection, ignorePaths,
 * });
 *
 * // src/server.ts
 * import { handleLocale } from './idiomi';
 *
 * const customHandler = defineHandlerCallback(async (ctx) => {
 *   const { locale, redirectResponse, localizedCtx } = handleLocale(ctx);
 *   if (redirectResponse) return redirectResponse;
 *   // Custom logic here with locale
 *   return defaultStreamHandler(localizedCtx);
 * });
 * ```
 */
export function createHandleLocale<L extends string>(
  config: LocaleServerEntryConfig<L>,
): <Ctx extends { request: Request; responseHeaders: Headers }>(
  ctx: Ctx,
) => HandleLocaleResult<Ctx, L> {
  return (ctx) => {
    const { locale, redirectUrl, rewrittenUrl, setCookie } =
      handleLocaleRequest(ctx.request, config);

    // Handle redirect case
    if (redirectUrl) {
      const headers = new Headers();
      headers.set('Location', redirectUrl);
      if (setCookie) headers.set('Set-Cookie', setCookie);
      return {
        locale,
        redirectResponse: new Response(null, { status: 302, headers }),
        localizedCtx: ctx,
      };
    }

    // Set cookie on responseHeaders (for next request, not current)
    if (setCookie) {
      ctx.responseHeaders.append('Set-Cookie', setCookie);
    }

    // Handle rewrite case
    const localizedCtx = rewrittenUrl
      ? { ...ctx, request: new Request(rewrittenUrl, ctx.request) }
      : ctx;

    return { locale, localizedCtx };
  };
}
