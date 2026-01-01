'use client';

import type { RoutePattern } from '@idiomi/core/routes';
import { getLocaleHead, IdiomiContext, type RoutesMap } from '@idiomi/react';
import { usePathname } from 'next/navigation';
import React, { useContext } from 'react';
import { getCanonicalPath, getLocalizedPath } from './pattern-matching.js';

export interface LocaleHeadProps {
  /** Current pathname. Optional in client components (uses usePathname). */
  pathname?: string;
  /** Current locale. Optional in client components (uses IdiomiContext). */
  locale?: string;
}

export interface LocaleHeadConfig {
  /** Base URL for absolute URLs (e.g., 'https://example.com'). Empty string for relative URLs. */
  metadataBase?: string;
  /** All supported locales */
  locales: readonly string[];
  /** Default locale */
  defaultLocale: string;
  /** Route translations map (from compiled routes) */
  routes?: RoutesMap;
  /** Reverse route maps for localized → canonical path conversion */
  reverseRoutes?: Record<string, Record<string, string>>;
  /** Route patterns for dynamic segment matching */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routePatterns?: readonly RoutePattern<any>[];
  /** Prefix strategy for locale URLs */
  prefixStrategy?: 'always' | 'as-needed' | 'never';
}

/**
 * Creates a LocaleHead component with configuration pre-baked.
 *
 * Use this factory in your idiomi/index.ts to create a configured LocaleHead.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts
 * import { createLocaleHead } from '@idiomi/next';
 * import { routes } from './.generated/routes';
 *
 * export const LocaleHead = createLocaleHead({
 *   metadataBase: 'https://example.com',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en',
 *   routes,
 * });
 *
 * // Client component - zero props needed!
 * 'use client';
 * import { LocaleHead } from '@/idiomi';
 *
 * function MyComponent() {
 *   return <LocaleHead />;
 * }
 *
 * // Server component - both props required
 * import { LocaleHead } from '@/idiomi';
 *
 * export default function Layout({ params }) {
 *   return (
 *     <html>
 *       <head>
 *         <LocaleHead pathname="/about" locale={params.lang} />
 *       </head>
 *     </html>
 *   );
 * }
 * ```
 */
export function createLocaleHead(config: LocaleHeadConfig) {
  const {
    metadataBase = '',
    locales,
    defaultLocale,
    routes,
    reverseRoutes,
    routePatterns = [],
    prefixStrategy = 'always',
  } = config;

  /**
   * Strip locale prefix from pathname.
   * E.g., /es/articulos/hello → /articulos/hello
   */
  function stripLocalePrefix(pathname: string): {
    path: string;
    locale: string | null;
  } {
    for (const loc of locales) {
      const prefix = `/${loc}`;
      if (pathname === prefix) {
        return { path: '/', locale: loc };
      }
      if (pathname.startsWith(`${prefix}/`)) {
        return { path: pathname.slice(prefix.length), locale: loc };
      }
    }
    return { path: pathname, locale: null };
  }

  return function LocaleHead(props: LocaleHeadProps): React.ReactElement {
    // Try props first, fall back to hooks
    const routerPathname = usePathname();
    const context = useContext(IdiomiContext);

    const rawPathname = props.pathname ?? routerPathname;
    const locale = props.locale ?? context?.locale;

    if (!rawPathname || !locale) {
      throw new Error(
        '[idiomi] LocaleHead requires pathname and locale. Either:\n' +
          '1. Use in a Client Component with IdiomiProvider (auto from context/router)\n' +
          '2. Pass both props: <LocaleHead pathname="/about" locale={params.lang} />',
      );
    }

    // Step 1: Strip locale prefix from pathname
    // usePathname() returns /es/articulos/hello, we need /articulos/hello
    const { path: pathWithoutLocale, locale: pathLocale } =
      stripLocalePrefix(rawPathname);

    // Step 2: Convert localized path to canonical using pattern matching
    // /articulos/hello → /blog/hello
    const canonicalPath = getCanonicalPath(
      pathWithoutLocale,
      pathLocale || locale,
      reverseRoutes ?? {},
      routePatterns,
    );

    // Step 3: Create a getLocalizedPathFn for getLocaleHead
    // This converts canonical → localized for each locale
    const getLocalizedPathFn = (path: string, targetLocale: string): string => {
      return getLocalizedPath(path, targetLocale, routes ?? {}, routePatterns);
    };

    const { links, canonical } = getLocaleHead({
      pathname: canonicalPath,
      locale,
      metadataBase,
      locales,
      defaultLocale,
      routes,
      prefixStrategy,
      getLocalizedPathFn,
    });

    return (
      <>
        <link rel="canonical" href={canonical} />
        {links.map(({ hreflang, href }) => (
          <link
            key={hreflang}
            rel="alternate"
            hrefLang={hreflang}
            href={href}
          />
        ))}
      </>
    );
  };
}
