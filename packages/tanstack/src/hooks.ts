import { IdiomaContext } from '@idioma/react';
import { useContext } from 'react';

/**
 * Get the current locale from IdiomaContext.
 *
 * @example
 * ```tsx
 * import { useLocale } from '@idioma/tanstack-react/hooks';
 *
 * function MyComponent() {
 *   const locale = useLocale();
 *   return <div>Current: {locale}</div>;
 * }
 * ```
 */
export function useLocale(): string {
  const context = useContext(IdiomaContext);
  if (!context) {
    throw new Error(
      '[idioma] useLocale must be used within an IdiomaProvider. ' +
        'Make sure to wrap your app with <IdiomaProvider>.',
    );
  }
  return context.locale;
}

/**
 * Get a localized path from the routes map.
 *
 * Uses the current locale from context to look up the translated path.
 * Falls back to the original path if no translation exists.
 *
 * @example
 * ```tsx
 * import { useLocalizedPath } from '@idioma/tanstack-react/hooks';
 * import { routes } from './idioma/.generated/routes';
 *
 * function Navigation() {
 *   const aboutPath = useLocalizedPath('/about', routes);
 *   // Returns '/sobre' when locale is 'es'
 * }
 * ```
 */
export function useLocalizedPath(
  path: string,
  routes?: Record<string, Record<string, string>>,
  localeOverride?: string,
): string {
  const context = useContext(IdiomaContext);
  const locale = localeOverride ?? context?.locale;

  if (!routes || !locale) {
    return path;
  }

  const localeRoutes = routes[locale];
  if (!localeRoutes) {
    return path;
  }

  return localeRoutes[path] ?? path;
}
