/**
 * TanStack Router integration for Idioma i18n.
 *
 * @example
 * ```tsx
 * // idioma/index.ts - configure once
 * import { createLink, createLocaleHead } from '@idioma/tanstack';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink(routes);
 * export const LocaleHead = createLocaleHead({ locales: ['en', 'es'], defaultLocale: 'en', routes });
 *
 * // components/Navigation.tsx - use configured components
 * import { Link } from '@/idioma';
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
