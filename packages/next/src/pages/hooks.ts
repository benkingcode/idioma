import { useRouter } from 'next/router';

/**
 * Get a localized path for the Pages Router.
 *
 * Uses the router's current locale to look up the translated path.
 * Falls back to the original path if no translation exists.
 *
 * @example
 * ```tsx
 * // In a Pages Router component
 * import { useLocalizedPath } from '@idiomi/next/pages';
 * import { routes } from './idiomi/.generated/routes';
 *
 * function MyComponent() {
 *   const aboutPath = useLocalizedPath('/about', routes);
 *   // Returns '/sobre' when router.locale is 'es'
 * }
 * ```
 */
export function useLocalizedPath(
  path: string,
  routes?: Record<string, Record<string, string>>,
  localeOverride?: string,
): string {
  const router = useRouter();
  const locale = localeOverride ?? router.locale ?? router.defaultLocale;

  if (!routes || !locale) {
    return path;
  }

  const localeRoutes = routes[locale];
  if (!localeRoutes) {
    return path;
  }

  return localeRoutes[path] ?? path;
}
