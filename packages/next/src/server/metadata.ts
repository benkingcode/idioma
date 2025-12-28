import type { Metadata } from 'next';

export interface IdiomaMetadataOptions {
  /** Current canonical pathname (e.g., '/about') */
  pathname: string;
  /** Base URL of the site (e.g., 'https://example.com') */
  baseUrl: string;
  /** All supported locales */
  locales: string[];
  /** Default locale */
  defaultLocale: string;
  /** Current locale (for canonical URL) */
  currentLocale?: string;
  /** Prefix strategy: 'always' or 'as-needed' */
  prefixStrategy?: 'always' | 'as-needed';
  /** Route translations map (from compiled routes) */
  routes?: Record<string, Record<string, string>>;
}

/**
 * Generate Next.js Metadata for internationalized pages.
 *
 * Creates alternates with hreflang links for all locales,
 * plus x-default pointing to the default locale.
 *
 * @example
 * ```tsx
 * // app/[lang]/about/page.tsx
 * import { generateIdiomaMetadata } from '@idioma/next/server';
 * import { routes } from './idioma/.generated/routes';
 *
 * export function generateMetadata({ params }: { params: { lang: string } }) {
 *   return generateIdiomaMetadata({
 *     pathname: '/about',
 *     baseUrl: 'https://example.com',
 *     locales: ['en', 'es', 'fr'],
 *     defaultLocale: 'en',
 *     currentLocale: params.lang,
 *     routes,
 *   });
 * }
 * ```
 */
export function generateIdiomaMetadata(
  options: IdiomaMetadataOptions,
): Pick<Metadata, 'alternates'> {
  const {
    pathname,
    baseUrl,
    locales,
    defaultLocale,
    currentLocale,
    prefixStrategy = 'always',
    routes,
  } = options;

  // Normalize baseUrl (remove trailing slash)
  const base = baseUrl.replace(/\/$/, '');

  // Build language alternates
  const languages: Record<string, string> = {};

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

    languages[locale] = url;
  }

  // Add x-default pointing to default locale URL
  // Note: defaultLocale is guaranteed to be in locales array
  const defaultLocaleUrl = languages[defaultLocale] as string;
  languages['x-default'] = defaultLocaleUrl;

  // Canonical URL - use current locale if specified, otherwise default
  const canonicalLocale = currentLocale ?? defaultLocale;
  const canonical = languages[canonicalLocale] ?? defaultLocaleUrl;

  return {
    alternates: {
      canonical,
      languages,
    },
  };
}
