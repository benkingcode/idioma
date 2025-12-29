'use client';

import { IdiomiContext } from '@idiomi/react';
import NextLink from 'next/link';
import { useContext, type ComponentProps } from 'react';

/** Route translations map type */
export type RoutesMap = Record<string, Record<string, string>>;

/** Configuration for Link with locale prefix support */
export interface LinkConfig {
  routes?: RoutesMap;
  defaultLocale: string;
  prefixStrategy: 'always' | 'as-needed' | 'never';
}

export interface LinkProps extends Omit<
  ComponentProps<typeof NextLink>,
  'href'
> {
  /** The canonical path to link to */
  href: string;
  /** Target locale. Defaults to current locale from IdiomiContext. */
  locale?: string;
  /** Route translations map (from compiled routes) - not needed if using createLink */
  routes?: RoutesMap;
}

/**
 * Resolves a canonical path to a localized path (without locale prefix).
 * Consistent with @idiomi/next/pages and @idiomi/tanstack-react.
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
 * Resolves a canonical path to a fully localized href with locale prefix.
 * Handles prefix strategy to determine when locale prefix is added.
 *
 * @example
 * ```tsx
 * // With prefixStrategy: 'as-needed' and defaultLocale: 'en'
 * resolveLocalizedHref('/about', 'es', config); // => '/es/sobre'
 * resolveLocalizedHref('/about', 'en', config); // => '/about' (no prefix for default)
 *
 * // With prefixStrategy: 'always'
 * resolveLocalizedHref('/about', 'en', config); // => '/en/about'
 * ```
 */
export function resolveLocalizedHref(
  href: string,
  locale: string,
  config: LinkConfig,
): string {
  const { routes, defaultLocale, prefixStrategy } = config;
  const localizedPath = resolveLocalizedPath(href, locale, routes);

  if (prefixStrategy === 'never') {
    return localizedPath;
  }

  const needsPrefix = prefixStrategy === 'always' || locale !== defaultLocale;

  return needsPrefix ? `/${locale}${localizedPath}` : localizedPath;
}

/**
 * Creates a localized Link component with routes pre-configured.
 *
 * Use this factory in your idiomi/index.ts to avoid passing routes to every Link.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts
 * import { createLink } from '@idiomi/next';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink({
 *   routes,
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 * });
 *
 * // Then in components:
 * import { Link } from './idiomi';
 *
 * // In Client Component with IdiomiProvider - no locale needed
 * <Link href="/about">About</Link>  // => /es/sobre (if current locale is 'es')
 *
 * // Language switcher - explicit locale
 * <Link href="/about" locale="es">Español</Link>  // => /es/sobre
 *
 * // When imported from Server Component - pass locale from params
 * <Link href="/about" locale={params.lang}>About</Link>
 * ```
 */
export function createLink(config: LinkConfig) {
  const { routes } = config;

  return function Link({
    href,
    locale: localeProp,
    routes: routesProp,
    ...props
  }: LinkProps) {
    const context = useContext(IdiomiContext);
    const locale = localeProp ?? context?.locale;

    if (!locale) {
      throw new Error(
        '[idiomi] Link requires a locale. Either:\n' +
          '1. Use within IdiomiProvider (locale from context)\n' +
          '2. Pass locale prop: <Link href="/about" locale={params.lang}>',
      );
    }

    const routesMap = routesProp ?? routes;
    const finalHref = resolveLocalizedHref(href, locale, {
      ...config,
      routes: routesMap,
    });

    return <NextLink href={finalHref} {...props} />;
  };
}
