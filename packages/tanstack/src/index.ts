/**
 * TanStack Router integration for Idioma i18n.
 *
 * @example
 * ```tsx
 * import { Link, useLocale, useLocalizedPath } from '@idioma/tanstack';
 * import { routes } from './idioma/.generated/routes';
 *
 * function Navigation() {
 *   const locale = useLocale();
 *   const aboutPath = useLocalizedPath('/about', routes);
 *
 *   return (
 *     <nav>
 *       <Link to="/about" routes={routes}>About</Link>
 *       <Link to="/blog" routes={routes}>Blog</Link>
 *     </nav>
 *   );
 * }
 * ```
 */

export {
  createLink,
  Link,
  resolveLocalizedPath,
  type LinkProps,
  type RoutesMap,
} from './link.js';
export { useLocale, useLocalizedPath } from './hooks.js';
export {
  HreflangLinks,
  useHreflangLinks,
  type HreflangLinksOptions,
  type HreflangLinksProps,
  type HreflangLink,
} from './head.js';
