/**
 * Pure function to generate hreflang link data for SEO.
 * No hooks or React dependencies - works anywhere.
 */

export interface HreflangLink {
  hreflang: string;
  href: string;
}

export interface LocaleHeadData {
  /** Array of hreflang links for all locales plus x-default */
  links: HreflangLink[];
  /** Canonical URL for the current locale */
  canonical: string;
}

export type RoutesMap = Record<string, Record<string, string>>;

export interface GetLocaleHeadOptions {
  /** Current pathname (e.g., '/about') */
  pathname: string;
  /** Current locale */
  locale: string;
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
 * Generate hreflang link data for SEO.
 *
 * Returns an array of hreflang links for all locales plus x-default,
 * and the canonical URL for the current locale.
 *
 * @example
 * ```ts
 * import { getLocaleHead } from '@idioma/react';
 *
 * const { links, canonical } = getLocaleHead({
 *   pathname: '/about',
 *   locale: 'es',
 *   metadataBase: 'https://example.com',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en',
 * });
 *
 * // links = [
 * //   { hreflang: 'en', href: 'https://example.com/en/about' },
 * //   { hreflang: 'es', href: 'https://example.com/es/about' },
 * //   { hreflang: 'fr', href: 'https://example.com/fr/about' },
 * //   { hreflang: 'x-default', href: 'https://example.com/en/about' },
 * // ]
 * // canonical = 'https://example.com/es/about'
 * ```
 */
export function getLocaleHead(options: GetLocaleHeadOptions): LocaleHeadData {
  const {
    pathname,
    locale,
    metadataBase = '',
    locales,
    defaultLocale,
    prefixStrategy = 'always',
    routes,
  } = options;

  // Normalize base (remove trailing slash)
  const base = metadataBase.replace(/\/$/, '');

  const links: HreflangLink[] = [];
  let canonical = '';

  for (const loc of locales) {
    // Get localized path from routes map, or use canonical path
    let localizedPath = pathname;
    if (routes?.[loc]?.[pathname]) {
      localizedPath = routes[loc][pathname];
    }

    // Determine URL with or without locale prefix
    let url: string;
    if (prefixStrategy === 'as-needed' && loc === defaultLocale) {
      // Default locale without prefix
      url = `${base}${localizedPath}`;
    } else {
      // Add locale prefix - handle root path specially to avoid //
      if (localizedPath === '/') {
        url = `${base}/${loc}`;
      } else {
        url = `${base}/${loc}${localizedPath}`;
      }
    }

    links.push({ hreflang: loc, href: url });

    // Track canonical URL for current locale
    if (loc === locale) {
      canonical = url;
    }
  }

  // Add x-default pointing to default locale URL
  const defaultUrl = links.find((l) => l.hreflang === defaultLocale)?.href;
  if (defaultUrl) {
    links.push({ hreflang: 'x-default', href: defaultUrl });
  }

  // Fallback canonical if locale not found in locales array
  if (!canonical && links.length > 0) {
    canonical = defaultUrl ?? links[0]?.href ?? '';
  }

  return { links, canonical };
}
