'use client';

import { getLocaleHead, type RoutesMap } from '@idiomi/react';
import { useRouter } from 'next/router';
import React from 'react';

export interface LocaleHeadProps {
  /** Current pathname. Optional (uses router.asPath). */
  pathname?: string;
  /** Current locale. Optional (uses router.locale). */
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
  /** Prefix strategy for locale URLs */
  prefixStrategy?: 'always' | 'as-needed' | 'never';
}

/**
 * Creates a LocaleHead component for Next.js Pages Router.
 *
 * Use this factory in your idiomi/index.ts to create a configured LocaleHead.
 *
 * Note: Wrap with next/head's <Head> component to render in document head.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts
 * import { createLocaleHead } from '@idiomi/next/pages';
 * import { routes } from './.generated/routes';
 *
 * export const LocaleHead = createLocaleHead({
 *   metadataBase: 'https://example.com',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en',
 *   routes,
 * });
 *
 * // In a page
 * import Head from 'next/head';
 * import { LocaleHead } from '@/idiomi';
 *
 * function AboutPage() {
 *   return (
 *     <>
 *       <Head>
 *         <LocaleHead />
 *       </Head>
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
    const router = useRouter();

    // Get pathname from props or router (strip query string)
    const routerPathname = router.asPath.split('?')[0];
    const pathname = props.pathname ?? routerPathname;

    // Get locale from props or router
    const locale = props.locale ?? router.locale ?? router.defaultLocale;

    if (!pathname || !locale) {
      throw new Error(
        '[idiomi] LocaleHead requires pathname and locale. ' +
          'Ensure the component is used within a Pages Router context.',
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
