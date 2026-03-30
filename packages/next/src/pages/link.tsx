'use client';

import type { RoutePattern } from '@idiomi/core/routes';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import type { ComponentProps } from 'react';
import { getLocalizedPath as patternGetLocalizedPath } from '../pattern-matching.js';

export type RoutesMap = Record<string, Record<string, string>>;

/** Configuration for Pages Router Link */
export interface PagesLinkConfig {
  routes?: RoutesMap;
  routePatterns?: readonly RoutePattern<string>[];
  /** Default locale (for matching router.defaultLocale) */
  defaultLocale?: string;
  /** Prefix strategy (for matching with App Router style) */
  prefixStrategy?: 'always' | 'as-needed' | 'never';
}

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
 * Uses pattern matching to handle dynamic routes.
 *
 * @example
 * ```tsx
 * resolveLocalizedPath('/about', 'es', routes, patterns); // => '/sobre'
 * resolveLocalizedPath('/blog/hello', 'es', routes, patterns); // => '/articulos/hello'
 * ```
 */
export function resolveLocalizedPath(
  path: string,
  locale: string,
  routes?: RoutesMap,
  routePatterns?: readonly RoutePattern[],
): string {
  return patternGetLocalizedPath(
    path,
    locale,
    routes ?? {},
    routePatterns ?? [],
  );
}

/**
 * Factory to create a Link component with routes pre-configured.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts
 * import { createLink } from '@idiomi/next/pages';
 * import { routes, routePatterns } from './.generated/routes';
 *
 * export const Link = createLink({ routes, routePatterns });
 *
 * // Usage - dynamic routes work too
 * <Link href="/about">About</Link>
 * <Link href="/blog/hello">Post</Link>  // => /articulos/hello in Spanish
 * ```
 */
export function createLink(config?: PagesLinkConfig) {
  const { routes, routePatterns } = config ?? {};

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
      ? resolveLocalizedPath(href, targetLocale, routesMap, routePatterns)
      : href;

    return <NextLink href={localizedPath} locale={locale} {...props} />;
  };
}
