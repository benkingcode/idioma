import {
  isLocaleCompatible,
  matchLocale,
  parseAcceptLanguageHeader,
} from '@idiomi/core/locale';
import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';

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
    /** Detection priority order */
    order?: Array<'cookie' | 'header'>;
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
 * Create TanStack Start middleware for Idiomi i18n.
 *
 * Features:
 * - Locale detection from cookie and Accept-Language header
 * - Locale prefix handling (always, as-needed, or never)
 * - Passes detected locale via middleware context
 *
 * @example
 * // src/start.ts
 * import { createStart } from '@tanstack/react-start';
 * import { createMiddleware } from './idiomi';
 *
 * export const startInstance = createStart(() => ({
 *   requestMiddleware: [createMiddleware()],
 * }));
 */
export function createIdiomiMiddleware(config: IdiomiMiddlewareConfig) {
  const {
    defaultLocale,
    locales,
    prefixStrategy = 'as-needed',
    detection = {},
  } = config;

  const {
    cookieName = 'IDIOMA_LOCALE',
    order = ['cookie', 'header'],
    algorithm = 'best fit',
  } = detection;

  return createMiddleware().server(async ({ request, next }) => {
    const url = new URL(request.url);

    // Skip static files (workaround for TanStack Start issue #2664)
    if (/\.[a-z0-9]+$/i.test(url.pathname)) {
      return next();
    }

    // Extract locale from path (if present)
    const pathLocale = extractLocaleFromPath(url.pathname, locales);

    // Detect locale from cookie/header if not in path
    let detectedLocale = pathLocale;
    if (!detectedLocale) {
      for (const source of order) {
        if (detectedLocale) break;

        if (source === 'cookie') {
          const cookieHeader = request.headers.get('cookie');
          const cookieLocale = parseCookie(cookieHeader, cookieName);
          if (cookieLocale && locales.includes(cookieLocale)) {
            detectedLocale = cookieLocale;
          }
        }

        if (source === 'header') {
          const acceptLanguage = request.headers.get('accept-language');
          if (acceptLanguage) {
            const matched = matchLocale(acceptLanguage, {
              locales,
              defaultLocale,
              algorithm,
            });
            if (matched !== defaultLocale) {
              // Real match found (not just fallback to default)
              detectedLocale = matched;
            } else {
              // Check if user actually requested the default locale
              // (e.g., 'en' header should match 'en-US' default via language distance)
              const requestedLocales =
                parseAcceptLanguageHeader(acceptLanguage);
              if (
                isLocaleCompatible(requestedLocales, defaultLocale, algorithm)
              ) {
                detectedLocale = matched;
              }
            }
          }
        }
      }
    }

    const locale = detectedLocale ?? defaultLocale;

    // Handle prefix strategy redirects
    if (prefixStrategy !== 'never' && !pathLocale) {
      if (prefixStrategy === 'always' || locale !== defaultLocale) {
        throw redirect({
          to: `/${locale}${url.pathname}${url.search}${url.hash}`,
        });
      }
    }

    return next({ context: { locale } });
  });
}

/**
 * Extract locale from the beginning of a path.
 * Returns the locale if found, otherwise undefined.
 */
function extractLocaleFromPath(
  pathname: string,
  locales: string[],
): string | undefined {
  const segment = pathname.split('/')[1];
  if (segment && locales.includes(segment)) {
    return segment;
  }
  return undefined;
}

/**
 * Parse a cookie value from a cookie header string.
 */
function parseCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1];
}

/** Configuration baked in by the factory */
export interface MiddlewareFactoryConfig {
  /** All supported locales */
  locales: string[];
  /** Default/source locale */
  defaultLocale: string;
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
    order?: Array<'cookie' | 'header'>;
    /**
     * Locale matching algorithm for Accept-Language header.
     * @default 'best fit'
     */
    algorithm?: 'lookup' | 'best fit';
  };
}

/**
 * Factory to create a simplified middleware creator with config pre-baked.
 *
 * Use this in your generated idiomi/index.ts to avoid passing locales.
 *
 * @example
 * ```typescript
 * // Generated in idiomi/index.ts
 * import { createMiddlewareFactory } from '@idiomi/tanstack-react/middleware';
 *
 * export const createMiddleware = createMiddlewareFactory({
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en',
 * });
 *
 * // Then in src/start.ts
 * import { createMiddleware } from './idiomi';
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
  const { locales, defaultLocale } = factoryConfig;

  return function createMiddleware(runtimeConfig?: MiddlewareRuntimeConfig) {
    return createIdiomiMiddleware({
      locales,
      defaultLocale,
      ...runtimeConfig,
    });
  };
}
