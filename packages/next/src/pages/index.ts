/**
 * Pages Router utilities for Next.js.
 *
 * @example
 * ```tsx
 * // idioma/index.ts
 * import { createLink } from '@idioma/next/pages';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink(routes);
 *
 * // In a Pages Router component
 * import { Link } from './idioma';
 *
 * function Navigation() {
 *   return (
 *     <nav>
 *       <Link href="/about">About</Link>
 *       <Link href="/blog">Blog</Link>
 *     </nav>
 *   );
 * }
 * ```
 */

export {
  createLink,
  resolveLocalizedPath,
  type PagesLinkProps,
  type RoutesMap,
} from './link.js';
export { useLocalizedPath } from './hooks.js';
export {
  createLocaleHead,
  type LocaleHeadProps,
  type LocaleHeadConfig,
} from './LocaleHead.js';
