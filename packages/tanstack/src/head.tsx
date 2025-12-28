import React from 'react';

export interface HreflangLinksOptions {
  /** Current canonical pathname (e.g., '/about') */
  pathname: string;
  /** Base URL of the site (e.g., 'https://example.com') */
  baseUrl: string;
  /** All supported locales */
  locales: string[];
  /** Default locale */
  defaultLocale: string;
  /** Prefix strategy: 'always' or 'as-needed' */
  prefixStrategy?: 'always' | 'as-needed';
  /** Route translations map (from compiled routes) */
  routes?: Record<string, Record<string, string>>;
}

export interface HreflangLink {
  hreflang: string;
  href: string;
}

/**
 * Generate hreflang link data for all locales.
 *
 * @example
 * ```tsx
 * import { useHreflangLinks } from '@idioma/tanstack/head';
 * import { routes } from './idioma/.generated/routes';
 *
 * function Head() {
 *   const links = useHreflangLinks({
 *     pathname: '/about',
 *     baseUrl: 'https://example.com',
 *     locales: ['en', 'es', 'fr'],
 *     defaultLocale: 'en',
 *     routes,
 *   });
 *
 *   return (
 *     <>
 *       {links.map(({ hreflang, href }) => (
 *         <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href} />
 *       ))}
 *     </>
 *   );
 * }
 * ```
 */
export function useHreflangLinks(
  options: HreflangLinksOptions,
): HreflangLink[] {
  const {
    pathname,
    baseUrl,
    locales,
    defaultLocale,
    prefixStrategy = 'always',
    routes,
  } = options;

  // Normalize baseUrl (remove trailing slash)
  const base = baseUrl.replace(/\/$/, '');

  const links: HreflangLink[] = [];

  for (const locale of locales) {
    // Get localized path from routes map, or use canonical path
    let localizedPath = pathname;
    if (routes?.[locale]?.[pathname]) {
      localizedPath = routes[locale][pathname];
    }

    // Determine URL with or without locale prefix
    let url: string;
    if (prefixStrategy === 'as-needed' && locale === defaultLocale) {
      // Default locale without prefix
      url = `${base}${localizedPath}`;
    } else {
      // Add locale prefix - handle root path specially to avoid //
      if (localizedPath === '/') {
        url = `${base}/${locale}`;
      } else {
        url = `${base}/${locale}${localizedPath}`;
      }
    }

    links.push({ hreflang: locale, href: url });
  }

  // Add x-default pointing to default locale URL
  const defaultUrl = links.find((l) => l.hreflang === defaultLocale)?.href;
  if (defaultUrl) {
    links.push({ hreflang: 'x-default', href: defaultUrl });
  }

  return links;
}

export interface HreflangLinksProps extends HreflangLinksOptions {}

/**
 * Renders hreflang link tags for SEO.
 *
 * Use this component in your document head to provide
 * language alternatives to search engines.
 *
 * @example
 * ```tsx
 * import { HreflangLinks } from '@idioma/tanstack/head';
 * import { routes } from './idioma/.generated/routes';
 *
 * function Head() {
 *   return (
 *     <head>
 *       <HreflangLinks
 *         pathname="/about"
 *         baseUrl="https://example.com"
 *         locales={['en', 'es', 'fr']}
 *         defaultLocale="en"
 *         routes={routes}
 *       />
 *     </head>
 *   );
 * }
 * ```
 */
export function HreflangLinks(props: HreflangLinksProps): React.ReactElement {
  const links = useHreflangLinks(props);

  return (
    <>
      {links.map(({ hreflang, href }) => (
        <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href} />
      ))}
    </>
  );
}
