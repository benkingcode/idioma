/**
 * Pages Router utilities for Next.js.
 *
 * @example
 * ```tsx
 * // idiomi/index.ts
 * import { createLink } from '@idiomi/next/pages';
 * import { routes } from './.generated/routes';
 *
 * export const Link = createLink(routes);
 *
 * // In a Pages Router component
 * import { Link } from './idiomi';
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
