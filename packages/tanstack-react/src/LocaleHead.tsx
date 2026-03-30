'use client';

import { getLocaleHead, IdiomiContext, type RoutesMap } from '@idiomi/react';
import { useLocation } from '@tanstack/react-router';
import React, { useContext } from 'react';

export interface LocaleHeadProps {
  /** Current pathname. Optional (uses useLocation). */
  pathname?: string;
  /** Current locale. Optional (uses IdiomiContext). */
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
  /** Reverse route translations map (localized → canonical) */
  reverseRoutes?: RoutesMap;
  /** Prefix strategy for locale URLs */
  prefixStrategy?: 'always' | 'as-needed' | 'never';
}

/**
 * Creates a LocaleHead component for TanStack Router.
 *
 * Use this factory in your idiomi/index.ts to create a configured LocaleHead.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts
 * import { createLocaleHead } from '@idiomi/tanstack-react';
 * import { routes } from './.generated/routes';
 *
 * export const LocaleHead = createLocaleHead({
 *   metadataBase: 'https://example.com',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en',
 *   routes,
 * });
 *
 * // In a component (React 19 hoists to <head>)
 * import { LocaleHead } from '@/idiomi';
 *
 * function MyComponent() {
 *   return (
 *     <>
 *       <LocaleHead />
 *       <main>...</main>
 *     </>
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
    prefixStrategy = 'always',
  } = config;

  return function LocaleHead(props: LocaleHeadProps): React.ReactElement {
    // Get pathname from useLocation
    const location = useLocation();
    const routerPathname = location.pathname;

    // Get locale from context
    const context = useContext(IdiomiContext);

    const pathname = props.pathname ?? routerPathname;
    const locale = props.locale ?? context?.locale;

    if (!pathname || !locale) {
      throw new Error(
        '[idiomi] LocaleHead requires pathname and locale. Either:\n' +
          '1. Use within IdiomiProvider (locale from context, pathname from router)\n' +
          '2. Pass both props: <LocaleHead pathname="/about" locale="es" />',
      );
    }

    // TanStack Router returns the full localized URL (e.g., /es/sobre)
    // We need to extract the canonical path for getLocaleHead
    // 1. Strip locale prefix to get the localized path without prefix
    // 2. Use reverseRoutes to convert localized → canonical
    let canonicalPath = pathname;

    // Check if pathname starts with a locale prefix
    for (const loc of locales) {
      const prefix = `/${loc}`;
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        // Strip the locale prefix
        const pathWithoutLocale =
          pathname === prefix ? '/' : pathname.slice(prefix.length);

        // Use reverseRoutes to get canonical path (if available)
        if (reverseRoutes?.[loc]?.[pathWithoutLocale]) {
          canonicalPath = reverseRoutes[loc][pathWithoutLocale];
        } else {
          canonicalPath = pathWithoutLocale;
        }
        break;
      }
    }

    const { links, canonical } = getLocaleHead({
      pathname: canonicalPath,
      locale,
      metadataBase,
      locales,
      defaultLocale,
      routes,
      prefixStrategy,
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
