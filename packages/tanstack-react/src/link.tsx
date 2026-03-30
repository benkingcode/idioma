/** Route translations map type */
export type RoutesMap = Record<string, Record<string, string>>;

/** Configuration for locale prefix handling */
export interface LinkConfig {
  routes?: RoutesMap;
  defaultLocale: string;
  prefixStrategy: 'always' | 'as-needed' | 'never';
}

/**
 * Resolves a canonical path to a localized path (without locale prefix).
 * Pure function for path segment translation.
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
  path: string,
  locale: string,
  config: LinkConfig,
): string {
  const { routes, defaultLocale, prefixStrategy } = config;
  const localizedPath = resolveLocalizedPath(path, locale, routes);

  if (prefixStrategy === 'never') {
    return localizedPath;
  }

  const needsPrefix = prefixStrategy === 'always' || locale !== defaultLocale;

  return needsPrefix ? `/${locale}${localizedPath}` : localizedPath;
}
