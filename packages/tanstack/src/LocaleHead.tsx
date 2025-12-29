'use client';

import { getLocaleHead, IdiomaContext, type RoutesMap } from '@idioma/react';
import { useLocation } from '@tanstack/react-router';
import React, { useContext } from 'react';

export interface LocaleHeadProps {
  /** Current pathname. Optional (uses useLocation). */
  pathname?: string;
  /** Current locale. Optional (uses IdiomaContext). */
  locale?: string;
}

export interface LocaleHeadConfig {
  /** Base URL for absolute URLs (e.g., 'https://example.com'). Empty string for relative URLs. */
  metadataBase?: string;
  /** All supported locales */
  locales: string[];
  /** Default locale */
  defaultLocale: string;
  /** Route translations map (from compiled routes) */
  routes?: RoutesMap;
  /** Prefix strategy: 'always' or 'as-needed' */
  prefixStrategy?: 'always' | 'as-needed';
}

/**
 * Creates a LocaleHead component for TanStack Router.
 *
 * Use this factory in your idioma/index.ts to create a configured LocaleHead.
 *
 * @example
 * ```tsx
 * // idioma/index.ts
 * import { createLocaleHead } from '@idioma/tanstack';
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
 * import { LocaleHead } from '@/idioma';
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
    prefixStrategy = 'always',
  } = config;

  return function LocaleHead(props: LocaleHeadProps): React.ReactElement {
    // Get pathname from useLocation
    const location = useLocation();
    const routerPathname = location.pathname;

    // Get locale from context
    const context = useContext(IdiomaContext);

    const pathname = props.pathname ?? routerPathname;
    const locale = props.locale ?? context?.locale;

    if (!pathname || !locale) {
      throw new Error(
        '[idioma] LocaleHead requires pathname and locale. Either:\n' +
          '1. Use within IdiomaProvider (locale from context, pathname from router)\n' +
          '2. Pass both props: <LocaleHead pathname="/about" locale="es" />',
      );
    }

    const { links, canonical } = getLocaleHead({
      pathname,
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
