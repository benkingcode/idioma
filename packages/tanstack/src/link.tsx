'use client';

import { IdiomaContext } from '@idioma/react';
import { Link as TanStackLink } from '@tanstack/react-router';
import { useContext, type ComponentProps } from 'react';

export interface LinkProps extends Omit<
  ComponentProps<typeof TanStackLink>,
  'to'
> {
  /** The canonical path to link to */
  to: string;
  /** Override the current locale */
  locale?: string;
  /** Route translations map (from compiled routes) */
  routes?: Record<string, Record<string, string>>;
}

/**
 * Localized Link component for TanStack Router.
 *
 * Automatically transforms paths using the routes map when localized
 * paths are enabled.
 *
 * @example
 * ```tsx
 * // Basic usage (uses current locale from context)
 * <Link to="/about">About</Link>
 *
 * // With locale override
 * <Link to="/about" locale="es">Sobre nosotros</Link>
 *
 * // With localized paths
 * import { routes } from './idioma/.generated/routes';
 * <Link to="/about" routes={routes}>Sobre</Link>
 * // Renders to="/sobre" when locale is "es"
 * ```
 */
export function Link({ to, locale, routes, ...props }: LinkProps) {
  const context = useContext(IdiomaContext);
  const currentLocale = context?.locale;
  const targetLocale = locale ?? currentLocale;

  // Get localized path if routes map is provided
  let localizedPath = to;
  if (routes && targetLocale) {
    const localeRoutes = routes[targetLocale];
    if (localeRoutes?.[to]) {
      localizedPath = localeRoutes[to];
    }
  }

  return <TanStackLink to={localizedPath} {...props} />;
}
