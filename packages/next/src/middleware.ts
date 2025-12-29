import {
  isLocaleCompatible,
  matchLocale,
  parseAcceptLanguageHeader,
} from '@idiomi/core/locale';
import { NextRequest, NextResponse } from 'next/server';

export interface IdiomiMiddlewareConfig {
  /** Default/source locale */
  defaultLocale: string;
  /** All supported locales */
  locales: string[];
  /**
   * Locale prefix strategy for URLs.
   * - 'always': All locales prefixed (e.g., /en/about, /es/about)
   * - 'as-needed': Default locale unprefixed (e.g., /about, /es/about)
   * - 'never': No locale prefixes in URLs
   * @default 'as-needed'
   */
  prefixStrategy?: 'always' | 'as-needed' | 'never';
  /** Detection settings */
  detection?: {
    /** Cookie name for storing locale preference */
    cookieName?: string;
    /**
     * Detection priority order for locale detection.
     *
     * Note: Path locale (`/en/...`) is always checked first, regardless of this order.
     * This setting only affects detection when no locale is in the URL path.
     * The `'path'` value is accepted for backwards compatibility but has no effect.
     */
    order?: Array<'cookie' | 'header' | 'path'>;
    /**
     * Locale matching algorithm for Accept-Language header.
     * - 'best fit': Uses language distance (e.g., en-GB matches en-US)
     * - 'lookup': Strict RFC 4647 matching (e.g., en-GB only matches en)
     * @default 'best fit'
     */
    algorithm?: 'lookup' | 'best fit';
  };
  /** Route translations - only needed when localizedPaths is enabled */
  routes?: Record<string, Record<string, string>>;
  /** Reverse route maps - only needed when localizedPaths is enabled */
  reverseRoutes?: Record<string, Record<string, string>>;
}

/** Paths to skip (static files, API routes, Next.js internals) */
const SKIP_PATTERNS = [
  /^\/_next/,
  /^\/api\//,
  /\.[a-z0-9]+$/i, // Files with extensions (static assets)
];

/**
 * Create Next.js middleware for Idiomi i18n.
 *
 * Features:
 * - Locale detection from cookie, Accept-Language header, or path
 * - Locale prefix handling (always vs as-needed)
 * - URL rewriting for localized paths (when enabled)
 *
 * @example
 * // middleware.ts
 * import { createIdiomiMiddleware } from '@idiomi/next/middleware';
 *
 * export default createIdiomiMiddleware({
 *   defaultLocale: 'en',
 *   locales: ['en', 'es', 'fr'],
 *   prefixStrategy: 'as-needed',
 * });
 *
 * export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
 */
export function createIdiomiMiddleware(config: IdiomiMiddlewareConfig) {
  const {
    defaultLocale,
    locales,
    prefixStrategy = 'as-needed',
    detection = {},
    routes,
    reverseRoutes,
  } = config;

  const {
    cookieName = 'IDIOMA_LOCALE',
    order = ['cookie', 'header'],
    algorithm = 'best fit',
  } = detection;

  return function middleware(request: NextRequest): NextResponse | undefined {
    const { pathname } = request.nextUrl;

    // Skip static files, API routes, and Next.js internals
    if (shouldSkipPath(pathname)) {
      return undefined;
    }

    // Extract locale from path (if present)
    const pathLocale = extractLocaleFromPath(pathname, locales);
    const pathWithoutLocale = pathLocale
      ? pathname.slice(pathLocale.length + 1) || '/'
      : pathname;

    // Detect preferred locale (if not in path)
    let detectedLocale = pathLocale;
    if (!detectedLocale) {
      detectedLocale = detectLocale(
        request,
        order,
        cookieName,
        locales,
        defaultLocale,
        algorithm,
      );
    }

    // Use default locale if nothing detected
    const locale = detectedLocale || defaultLocale;

    // Handle prefix strategy
    if (prefixStrategy !== 'never' && !pathLocale) {
      // No locale in path
      if (prefixStrategy === 'always' || locale !== defaultLocale) {
        // Redirect to add locale prefix
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}${pathname}`;
        return NextResponse.redirect(url, 307);
      }
    }

    // Handle localized paths rewriting (when routes are provided)
    if (reverseRoutes && pathLocale) {
      const localeReverse = reverseRoutes[pathLocale];
      if (localeReverse) {
        const canonicalPath = localeReverse[pathWithoutLocale];
        if (canonicalPath && canonicalPath !== pathWithoutLocale) {
          // Rewrite to canonical path internally
          const url = request.nextUrl.clone();
          url.pathname = `/${pathLocale}${canonicalPath}`;
          const response = NextResponse.rewrite(url);
          response.headers.set('x-idiomi-rewrite', 'true');
          return response;
        }
      }
    }

    return undefined;
  };
}

/**
 * Check if path should be skipped by middleware.
 */
function shouldSkipPath(pathname: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Extract locale from the beginning of a path.
 * Returns the locale if found, otherwise undefined.
 */
function extractLocaleFromPath(
  pathname: string,
  locales: string[],
): string | undefined {
  const firstSegment = pathname.split('/')[1];
  if (firstSegment && locales.includes(firstSegment)) {
    return firstSegment;
  }
  return undefined;
}

/**
 * Detect locale from request using configured order.
 */
function detectLocale(
  request: NextRequest,
  order: Array<'cookie' | 'header' | 'path'>,
  cookieName: string,
  locales: string[],
  defaultLocale: string,
  algorithm: 'lookup' | 'best fit',
): string | undefined {
  for (const method of order) {
    let detected: string | undefined;

    switch (method) {
      case 'cookie': {
        const cookieValue = request.cookies.get(cookieName)?.value;
        if (cookieValue && locales.includes(cookieValue)) {
          detected = cookieValue;
        }
        break;
      }
      case 'header': {
        const acceptLanguage = request.headers.get('accept-language');
        if (acceptLanguage) {
          const matched = matchLocale(acceptLanguage, {
            locales,
            defaultLocale,
            algorithm,
          });
          if (matched !== defaultLocale) {
            // Real match found (not just fallback to default)
            detected = matched;
          } else {
            // Check if user actually requested the default locale
            // (e.g., 'en' header should match 'en-US' default via language distance)
            const requestedLocales = parseAcceptLanguageHeader(acceptLanguage);
            if (
              isLocaleCompatible(requestedLocales, defaultLocale, algorithm)
            ) {
              detected = matched;
            }
          }
        }
        break;
      }
      // 'path' is handled separately before this function
    }

    if (detected) {
      return detected;
    }
  }

  return undefined;
}

/** Configuration baked in by the factory */
export interface MiddlewareFactoryConfig {
  /** All supported locales */
  locales: string[];
  /** Default/source locale */
  defaultLocale: string;
  /** Route translations map (from compiled routes) */
  routes?: Record<string, Record<string, string>>;
  /** Reverse route maps (from compiled routes) */
  reverseRoutes?: Record<string, Record<string, string>>;
}

/** Runtime options that can be overridden */
export interface MiddlewareRuntimeConfig {
  /**
   * Locale prefix strategy for URLs.
   * @default 'as-needed'
   */
  prefixStrategy?: 'always' | 'as-needed' | 'never';
  /** Detection settings */
  detection?: {
    cookieName?: string;
    /**
     * Detection priority order. Path locale is always checked first.
     * @see IdiomiMiddlewareConfig.detection.order
     */
    order?: Array<'cookie' | 'header' | 'path'>;
    /**
     * Locale matching algorithm for Accept-Language header.
     * - 'best fit': Uses language distance (e.g., en-GB matches en-US)
     * - 'lookup': Strict RFC 4647 matching (e.g., en-GB only matches en)
     * @default 'best fit'
     */
    algorithm?: 'lookup' | 'best fit';
  };
}

/**
 * Factory to create a simplified middleware creator with config pre-baked.
 *
 * Use this in your generated idiomi/index.ts to avoid passing routes.
 *
 * @example
 * ```typescript
 * // Generated in idiomi/index.ts
 * import { createMiddlewareFactory } from '@idiomi/next/middleware';
 * import { routes, reverseRoutes } from './.generated/routes';
 *
 * export const createMiddleware = createMiddlewareFactory({
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en',
 *   routes,
 *   reverseRoutes,
 * });
 *
 * // Then in middleware.ts
 * import { createMiddleware } from './src/idiomi';
 *
 * export default createMiddleware(); // Uses all defaults!
 *
 * // Or with runtime overrides:
 * export default createMiddleware({
 *   prefixStrategy: 'always',
 * });
 * ```
 */
export function createMiddlewareFactory(
  factoryConfig: MiddlewareFactoryConfig,
) {
  const { locales, defaultLocale, routes, reverseRoutes } = factoryConfig;

  return function createMiddleware(runtimeConfig?: MiddlewareRuntimeConfig) {
    return createIdiomiMiddleware({
      locales,
      defaultLocale,
      routes,
      reverseRoutes,
      ...runtimeConfig,
    });
  };
}
