/**
 * TanStack Router integration for Idiomi i18n.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts - configure once
 * import { createLink, createLocaleHead } from '@idiomi/tanstack-react';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink(routes);
 * export const LocaleHead = createLocaleHead({ locales: ['en', 'es'], defaultLocale: 'en', routes });
 *
 * // components/Navigation.tsx - use configured components
 * import { Link } from '@/idiomi';
 *
 * function Navigation() {
 *   return (
 *     <nav>
 *       <Link to="/about">About</Link>
 *       <Link to="/blog">Blog</Link>
 *     </nav>
 *   );
 * }
 * ```
 */

export {
  createLink,
  resolveLocalizedPath,
  type LinkProps,
  type RoutesMap,
} from './link.js';
export { useLocale, useLocalizedPath } from './hooks.js';
export {
  createLocaleHead,
  type LocaleHeadProps,
  type LocaleHeadConfig,
} from './LocaleHead.js';
