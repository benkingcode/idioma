'use client';

import { IdiomaContext } from '@idioma/react';
import NextLink from 'next/link';
import { useContext, type ComponentProps } from 'react';

export interface LinkProps extends Omit<
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
 * Localized Link component for Next.js App Router.
 *
 * Automatically adds locale prefix and translates paths when
 * localized paths are enabled.
 *
 * @example
 * ```tsx
 * // Basic usage (uses current locale from context)
 * <Link href="/about">About</Link>
 *
 * // With locale override
 * <Link href="/about" locale="es">Sobre nosotros</Link>
 *
 * // With localized paths
 * import { routes } from './idioma/.generated/routes';
 * <Link href="/about" locale="es" routes={routes}>Sobre</Link>
 * // Renders: /es/sobre
 * ```
 */
export function Link({ href, locale, routes, ...props }: LinkProps) {
  const context = useContext(IdiomaContext);
  const currentLocale = context?.locale;
  const targetLocale = locale ?? currentLocale;

  // Get localized path if routes map is provided
  let localizedPath = href;
  if (routes && targetLocale) {
    const localeRoutes = routes[targetLocale];
    if (localeRoutes && localeRoutes[href]) {
      localizedPath = localeRoutes[href];
    }
  }

  // Add locale prefix
  const finalHref =
    targetLocale && targetLocale !== 'default'
      ? `/${targetLocale}${localizedPath}`
      : localizedPath;

  return <NextLink href={finalHref} {...props} />;
}
