/**
 * TanStack Router integration for Idiomi i18n.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts - configure once with compiled routes
 * import { createLocaleHead } from '@idiomi/tanstack-react';
 * import { routes, reverseRoutes } from './.generated/routes';
 *
 * // TanStack Router uses URL rewriting for locale handling.
 * // Link component is TanStack Router's native <Link> with params={{ locale }}.
 *
 * export const LocaleHead = createLocaleHead({
 *   locales: ['en', 'es'],
 *   defaultLocale: 'en',
 *   routes,
 *   reverseRoutes,
 * });
 *
 * // components/Navigation.tsx - use TanStack Router's native Link
 * import { Link } from '@tanstack/react-router';
 * import { useLocale } from '@/idiomi';
 *
 * function Navigation() {
 *   const locale = useLocale();
 *   return (
 *     <nav>
 *       <Link to="/{-$locale}/about" params={{ locale }}>About</Link>
 *       <Link to="/{-$locale}/blog" params={{ locale }}>Blog</Link>
 *     </nav>
 *   );
 * }
 * ```
 */

export {
  resolveLocalizedHref,
  resolveLocalizedPath,
  type LinkConfig,
  type RoutesMap,
} from './link.js';
export { useLocale, useLocalizedHref, useLocalizedPath } from './hooks.js';
export {
  createLocaleHead,
  type LocaleHeadProps,
  type LocaleHeadConfig,
} from './LocaleHead.js';
