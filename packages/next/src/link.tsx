'use client';

import { IdiomaContext } from '@idioma/react';
import NextLink from 'next/link';
import { useContext, type ComponentProps } from 'react';

/** Route translations map type */
export type RoutesMap = Record<string, Record<string, string>>;

export interface LinkProps extends Omit<
  ComponentProps<typeof NextLink>,
  'href'
> {
  /** The canonical path to link to */
  href: string;
  /** Target locale. Defaults to current locale from IdiomaContext. */
  locale?: string;
  /** Route translations map (from compiled routes) - not needed if using createLink */
  routes?: RoutesMap;
}

/**
 * Resolves a canonical path to a localized href with locale prefix.
 * Pure function for path resolution.
 */
export function resolveLocalizedHref(
  href: string,
  locale: string,
  routes?: RoutesMap,
): string {
  // Get localized path if routes map is provided
  let localizedPath = href;
  if (routes) {
    const localeRoutes = routes[locale];
    if (localeRoutes?.[href]) {
      localizedPath = localeRoutes[href];
    }
  }

  // Add locale prefix
  return `/${locale}${localizedPath}`;
}

/**
 * Creates a localized Link component with routes pre-configured.
 *
 * Use this factory in your idioma/index.ts to avoid passing routes to every Link.
 *
 * @example
 * ```tsx
 * // idioma/index.ts
 * import { createLink } from '@idioma/next';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink(routes);
 *
 * // Then in components:
 * import { Link } from './idioma';
 *
 * // In Client Component with IdiomaProvider - no locale needed
 * <Link href="/about">About</Link>
 *
 * // Language switcher - explicit locale
 * <Link href="/about" locale="es">Español</Link>
 *
 * // When imported from Server Component - pass locale from params
 * <Link href="/about" locale={params.lang}>About</Link>
 * ```
 */
export function createLink(routes?: RoutesMap) {
  return function Link({
    href,
    locale: localeProp,
    routes: routesProp,
    ...props
  }: LinkProps) {
    const context = useContext(IdiomaContext);
    const locale = localeProp ?? context?.locale;

    if (!locale) {
      throw new Error(
        '[idioma] Link requires a locale. Either:\n' +
          '1. Use within IdiomaProvider (locale from context)\n' +
          '2. Pass locale prop: <Link href="/about" locale={params.lang}>',
      );
    }

    const routesMap = routesProp ?? routes;
    const finalHref = resolveLocalizedHref(href, locale, routesMap);
    return <NextLink href={finalHref} {...props} />;
  };
}

/**
 * Localized Link component for Next.js App Router.
 *
 * - In Client Components with IdiomaProvider: locale is optional (from context)
 * - When imported from Server Components: pass locale prop
 * - For language switchers: pass explicit locale prop
 *
 * @example
 * ```tsx
 * // Client Component with provider - no locale needed
 * <Link href="/about">About</Link>
 *
 * // Language switcher
 * <Link href="/about" locale="es">Español</Link>
 *
 * // From Server Component - must pass locale
 * <Link href="/about" locale={params.lang}>About</Link>
 *
 * // With localized paths
 * import { routes } from './idioma/.generated/routes';
 * <Link href="/about" routes={routes}>About</Link>
 * // Renders: /es/sobre when locale is "es"
 * ```
 */
export const Link = createLink();
