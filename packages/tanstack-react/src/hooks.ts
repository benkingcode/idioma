import { IdiomiContext } from '@idiomi/react';
import { useContext } from 'react';
import {
  resolveLocalizedHref as resolveHref,
  type LinkConfig,
} from './link.js';

/**
 * Get the current locale from IdiomiContext.
 *
 * @example
 * ```tsx
 * import { useLocale } from '@idiomi/tanstack-react/hooks';
 *
 * function MyComponent() {
 *   const locale = useLocale();
 *   return <div>Current: {locale}</div>;
 * }
 * ```
 */
export function useLocale(): string {
  const context = useContext(IdiomiContext);
  if (!context) {
    throw new Error(
      '[idiomi] useLocale must be used within an IdiomiProvider. ' +
        'Make sure to wrap your app with <IdiomiProvider>.',
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
 * import { useLocalizedPath } from '@idiomi/tanstack-react/hooks';
 * import { routes } from './idiomi/.generated/routes';
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
  const context = useContext(IdiomiContext);
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

/**
 * Get a fully localized href with locale prefix from the config.
 *
 * Uses the current locale from context and the prefix strategy to build
 * the correct href with locale prefix when needed.
 *
 * @example
 * ```tsx
 * import { useLocalizedHref } from '@idiomi/tanstack-react/hooks';
 *
 * // Config from generated code
 * const config = {
 *   routes,
 *   defaultLocale: 'en',
 *   prefixStrategy: 'as-needed',
 * };
 *
 * function Navigation() {
 *   const aboutHref = useLocalizedHref('/about', config);
 *   // Returns '/es/sobre' when locale is 'es'
 *   // Returns '/about' when locale is 'en' (default, no prefix)
 * }
 * ```
 */
export function useLocalizedHref(
  path: string,
  config?: LinkConfig,
  localeOverride?: string,
): string {
  const context = useContext(IdiomiContext);
  const locale = localeOverride ?? context?.locale;

  if (!config || !locale) {
    return path;
  }

  return resolveHref(path, locale, config);
}
