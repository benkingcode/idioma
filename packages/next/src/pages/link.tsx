'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/router';
import type { ComponentProps } from 'react';

export interface PagesLinkProps extends Omit<
  ComponentProps<typeof NextLink>,
  'href'
> {
  /** The canonical path to link to */
  href: string;
  /** Override the current locale */
  locale?: string;
  /** Route translations map (from compiled routes) */
  routes?: Record<string, Record<string, string>>;
}

/**
 * Localized Link component for Next.js Pages Router.
 *
 * Automatically transforms paths using the routes map when localized
 * paths are enabled. Uses next/link's built-in locale handling.
 *
 * @example
 * ```tsx
 * // Basic usage (uses router.locale)
 * <Link href="/about">About</Link>
 *
 * // With locale override
 * <Link href="/about" locale="es">Sobre nosotros</Link>
 *
 * // With localized paths
 * import { routes } from './idioma/.generated/routes';
 * <Link href="/about" routes={routes}>Sobre</Link>
 * // Renders href="/sobre" when locale is "es"
 * ```
 */
export function Link({ href, locale, routes, ...props }: PagesLinkProps) {
  const router = useRouter();
  const targetLocale = locale ?? router.locale ?? router.defaultLocale;

  // Get localized path if routes map is provided
  let localizedPath = href;
  if (routes && targetLocale) {
    const localeRoutes = routes[targetLocale];
    if (localeRoutes?.[href]) {
      localizedPath = localeRoutes[href];
    }
  }

  return <NextLink href={localizedPath} locale={locale} {...props} />;
}
