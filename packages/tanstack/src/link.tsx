'use client';

import { IdiomaContext } from '@idioma/react';
import { Link as TanStackLink } from '@tanstack/react-router';
import { useContext, type ComponentProps } from 'react';

/** Route translations map type */
export type RoutesMap = Record<string, Record<string, string>>;

export interface LinkProps extends Omit<
  ComponentProps<typeof TanStackLink>,
  'to'
> {
  /** The canonical path to link to */
  to: string;
  /** Target locale. Defaults to current locale from IdiomaContext. */
  locale?: string;
  /** Route translations map (from compiled routes) - not needed if using createLink */
  routes?: RoutesMap;
}

/**
 * Resolves a canonical path to a localized path.
 * Pure function for path resolution.
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
 * Creates a localized Link component with routes pre-configured.
 *
 * Use this factory in your idioma/index.ts to avoid passing routes to every Link.
 *
 * @example
 * ```tsx
 * // idioma/index.ts
 * import { createLink } from '@idioma/tanstack-react';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink(routes);
 *
 * // Then in components:
 * import { Link } from './idioma';
 *
 * // With IdiomaProvider - no locale needed
 * <Link to="/about">About</Link>
 *
 * // Language switcher - explicit locale
 * <Link to="/about" locale="es">Español</Link>
 * ```
 */
export function createLink(routes?: RoutesMap) {
  return function Link({
    to,
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
          '2. Pass locale prop: <Link to="/about" locale="es">',
      );
    }

    const routesMap = routesProp ?? routes;
    const localizedPath = resolveLocalizedPath(to, locale, routesMap);

    return <TanStackLink to={localizedPath} {...props} />;
  };
}
