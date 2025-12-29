'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/router';
import type { ComponentProps } from 'react';

export type RoutesMap = Record<string, Record<string, string>>;

export interface PagesLinkProps extends Omit<
  ComponentProps<typeof NextLink>,
  'href'
> {
  /** The canonical path to link to */
  href: string;
  /** Override the current locale */
  locale?: string;
  /** Route translations map (from compiled routes) */
  routes?: RoutesMap;
}

/**
 * Resolve a canonical path to a localized path.
 *
 * @example
 * ```tsx
 * resolveLocalizedPath('/about', 'es', routes); // => '/sobre'
 * ```
 */
export function resolveLocalizedPath(
  path: string,
  locale: string,
  routes?: RoutesMap,
): string {
  if (!routes) return path;
  const localeRoutes = routes[locale];
  if (localeRoutes?.[path]) {
    return localeRoutes[path];
  }
  return path;
}

/**
 * Factory to create a Link component with routes pre-configured.
 *
 * @example
 * ```tsx
 * // idioma/index.ts
 * import { createLink } from '@idioma/next/pages';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink(routes);
 *
 * // Usage
 * <Link href="/about">About</Link>
 * ```
 */
export function createLink(routes?: RoutesMap) {
  return function Link({
    href,
    locale,
    routes: routesProp,
    ...props
  }: PagesLinkProps) {
    const router = useRouter();
    const targetLocale = locale ?? router.locale ?? router.defaultLocale;

    const routesMap = routesProp ?? routes;
    const localizedPath = targetLocale
      ? resolveLocalizedPath(href, targetLocale, routesMap)
      : href;

    return <NextLink href={localizedPath} locale={locale} {...props} />;
  };
}
