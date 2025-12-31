/**
 * SSR-aware factories for TanStack Start locale handling.
 *
 * This module provides locale detection that works on both server and client,
 * with Accept-Language header support during SSR.
 *
 * @example
 * ```typescript
 * // idiomi/index.ts (for TanStack Start apps)
 * import { createLocaleLoader } from '@idiomi/tanstack-react/start';
 * import { locales, defaultLocale, prefixStrategy, detection } from './.generated/config';
 *
 * export const { localeLoader, detectClientLocale } = createLocaleLoader({
 *   locales, defaultLocale, prefixStrategy, detection,
 * });
 * ```
 */

import { matchLocale } from '@idiomi/core/locale';
import { redirect } from '@tanstack/react-router';
// NOTE: getRequestHeaders must be dynamically imported to avoid bundling server code in client
// Import types used internally
import type {
  LocaleLoaderApi,
  LocaleLoaderConfig,
  LocaleLoaderResult,
  LocationInfo,
} from './spa.js';

// Re-export types from spa.ts for API compatibility
export type {
  DetectionConfig,
  LocaleLoaderApi,
  LocaleLoaderConfig,
  LocaleLoaderResult,
  LocationInfo,
} from './spa.js';

// Re-export server entry helpers for TanStack Start SSR
export {
  createHandleLocale,
  detectLocaleFromRequest,
  handleLocaleRequest,
  type HandleLocaleResult,
  type LocaleDetectionConfig,
  type LocaleResult,
  type LocaleServerEntryConfig,
} from './server-entry.js';

// Re-export SPA factories for non-localized routes
export { createDetectLocale, type DetectLocaleConfig } from './spa.js';

// ============================================================
// createDetectLocale Factory (SSR-aware)
// ============================================================

/**
 * Config for SSR-aware locale detection.
 */
export interface DetectLocaleSsrConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly detection: {
    readonly order: readonly ('cookie' | 'header')[];
    readonly cookieName: string;
  };
}

/**
 * Creates an SSR-aware locale detection function for TanStack Start.
 *
 * Unlike the SPA version, this factory:
 * - Accesses Accept-Language header during SSR via getRequestHeaders()
 * - Uses @idiomi/core/locale's matchLocale() for BCP 47-compliant matching
 * - Falls back to navigator.languages on the client
 *
 * @example
 * ```typescript
 * import { createDetectLocaleSsr } from '@idiomi/tanstack-react/start';
 *
 * const detectLocale = createDetectLocaleSsr({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   detection: { order: ['cookie', 'header'], cookieName: 'IDIOMI_LOCALE' },
 * });
 *
 * // In __root.tsx for non-localized routes:
 * function RootComponent() {
 *   const locale = detectLocale(); // Works on both server and client
 *   return <IdiomiProvider locale={locale}>...</IdiomiProvider>;
 * }
 * ```
 */
export function createDetectLocaleSsr<L extends string>(
  config: DetectLocaleSsrConfig<L>,
): () => L {
  const { locales, defaultLocale, detection } = config;

  function getCookieValue(
    cookieHeader: string | null,
    name: string,
  ): string | undefined {
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match?.[1];
  }

  // Cached headers for synchronous access after async initialization
  let cachedHeaders: {
    cookie: string | null;
    acceptLanguage: string | null;
  } | null = null;

  return function detectLocale(): L {
    const isServer = typeof window === 'undefined';

    let cookieHeader: string | null = null;
    let acceptLanguage: string | null = null;

    if (isServer) {
      // Server: access request headers directly via dynamic import
      // This pattern avoids bundling server code into client
      if (!cachedHeaders) {
        // Synchronous require fallback for SSR - the dynamic import is already resolved
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getRequestHeaders } = require('@tanstack/react-start/server');
        const headers = getRequestHeaders();
        cachedHeaders = {
          cookie: headers.get('cookie'),
          acceptLanguage: headers.get('accept-language'),
        };
      }
      cookieHeader = cachedHeaders.cookie;
      acceptLanguage = cachedHeaders.acceptLanguage;
    } else {
      cookieHeader = typeof document !== 'undefined' ? document.cookie : null;
    }

    for (const source of detection.order) {
      if (source === 'cookie') {
        const cookie = getCookieValue(cookieHeader, detection.cookieName);
        if (cookie && (locales as readonly string[]).includes(cookie)) {
          return cookie as L;
        }
      }
      if (source === 'header') {
        if (isServer && acceptLanguage) {
          // Server: use Accept-Language header
          const matched = matchLocale(acceptLanguage, {
            locales: locales as unknown as string[],
            defaultLocale,
            algorithm: 'best fit',
          });
          if (matched && (locales as readonly string[]).includes(matched)) {
            return matched as L;
          }
        } else if (!isServer) {
          // Client: use navigator.languages
          if (typeof navigator !== 'undefined' && navigator.languages?.length) {
            const matched = matchLocale(navigator.languages.join(','), {
              locales: locales as unknown as string[],
              defaultLocale,
              algorithm: 'best fit',
            });
            if (matched && (locales as readonly string[]).includes(matched)) {
              return matched as L;
            }
          }
        }
      }
    }

    return defaultLocale;
  };
}

// ============================================================
// createLocaleLoader Factory (SSR-aware)
// ============================================================

/**
 * Creates locale detection functions for TanStack Start with SSR support.
 *
 * Unlike the SPA version, this factory:
 * - Accesses Accept-Language header during SSR via getRequestHeaders()
 * - Uses @idiomi/core/locale's matchLocale() for BCP 47-compliant matching
 * - Falls back to navigator.languages on the client
 *
 * Vite tree-shakes getRequestHeaders() from client bundles since it's
 * only used in a `typeof window === 'undefined'` branch.
 *
 * @example
 * ```typescript
 * import { createLocaleLoader } from '@idiomi/tanstack-react/start';
 *
 * export const { localeLoader, detectClientLocale } = createLocaleLoader({
 *   locales: ['en', 'es'] as const,
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 *   detection: { order: ['cookie', 'header'], cookieName: 'IDIOMI_LOCALE' },
 * });
 *
 * // Use in route definition:
 * export const Route = createFileRoute('/{-$locale}')({
 *   beforeLoad: localeLoader,
 *   component: LocaleLayout,
 * });
 * ```
 */
export function createLocaleLoader<L extends string>(
  config: LocaleLoaderConfig<L>,
): LocaleLoaderApi<L> {
  const { locales, defaultLocale, prefixStrategy, detection } = config;

  // Internal helpers
  function extractLocaleFromPath(pathname: string): L | undefined {
    const segment = pathname.split('/')[1];
    if (segment && (locales as readonly string[]).includes(segment)) {
      return segment as L;
    }
    return undefined;
  }

  function getCookieValue(
    cookieHeader: string | null,
    name: string,
  ): string | undefined {
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match?.[1];
  }

  /**
   * Detect locale from cookie/browser on the client side.
   * This is synchronous and doesn't access server headers.
   */
  function detectClientLocale(): L {
    for (const source of detection.order) {
      if (source === 'cookie') {
        if (typeof document !== 'undefined') {
          const cookie = getCookieValue(document.cookie, detection.cookieName);
          if (cookie && (locales as readonly string[]).includes(cookie)) {
            return cookie as L;
          }
        }
      }
      if (source === 'header') {
        // 'header' = navigator.languages on client
        if (typeof navigator !== 'undefined' && navigator.languages?.length) {
          const matched = matchLocale(navigator.languages.join(','), {
            locales: locales as unknown as string[],
            defaultLocale,
            algorithm: 'best fit',
          });
          if (matched && (locales as readonly string[]).includes(matched)) {
            return matched as L;
          }
        }
      }
    }
    return defaultLocale;
  }

  // Cached headers for synchronous access after async initialization
  let cachedLoaderHeaders: {
    cookie: string | null;
    acceptLanguage: string | null;
  } | null = null;

  /**
   * Detect locale with full SSR support.
   * On server: checks cookie header, Accept-Language header
   * On client: checks document.cookie, navigator.languages
   */
  function detectLocale(): L {
    const isServer = typeof window === 'undefined';

    let cookieHeader: string | null = null;
    let acceptLanguage: string | null = null;

    if (isServer) {
      // Server: access request headers directly via dynamic import
      // This pattern avoids bundling server code into client
      if (!cachedLoaderHeaders) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getRequestHeaders } = require('@tanstack/react-start/server');
        const headers = getRequestHeaders();
        cachedLoaderHeaders = {
          cookie: headers.get('cookie'),
          acceptLanguage: headers.get('accept-language'),
        };
      }
      cookieHeader = cachedLoaderHeaders.cookie;
      acceptLanguage = cachedLoaderHeaders.acceptLanguage;
    } else {
      cookieHeader = typeof document !== 'undefined' ? document.cookie : null;
    }

    for (const source of detection.order) {
      if (source === 'cookie') {
        const cookie = getCookieValue(cookieHeader, detection.cookieName);
        if (cookie && (locales as readonly string[]).includes(cookie)) {
          return cookie as L;
        }
      }
      if (source === 'header') {
        if (isServer && acceptLanguage) {
          // Server: use Accept-Language header
          const matched = matchLocale(acceptLanguage, {
            locales: locales as unknown as string[],
            defaultLocale,
            algorithm: 'best fit',
          });
          if (matched && (locales as readonly string[]).includes(matched)) {
            return matched as L;
          }
        } else if (!isServer) {
          // Client: use navigator.languages
          if (typeof navigator !== 'undefined' && navigator.languages?.length) {
            const matched = matchLocale(navigator.languages.join(','), {
              locales: locales as unknown as string[],
              defaultLocale,
              algorithm: 'best fit',
            });
            if (matched && (locales as readonly string[]).includes(matched)) {
              return matched as L;
            }
          }
        }
      }
    }

    return defaultLocale;
  }

  /**
   * TanStack Router beforeLoad function for SSR-aware locale detection.
   * Handles redirects based on prefixStrategy.
   */
  function localeLoader({
    location,
  }: {
    location: LocationInfo;
  }): LocaleLoaderResult<L> {
    const pathLocale = extractLocaleFromPath(location.pathname);

    // Strategy: 'never' - no URL prefixes, just detect
    if (prefixStrategy === 'never') {
      const detected = pathLocale ?? detectLocale();
      return { locale: detected };
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
