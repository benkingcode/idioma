/**
 * Pages Router utilities for Next.js.
 *
 * @example
 * ```tsx
 * // In a Pages Router component
 * import { Link, useLocalizedPath } from '@idioma/next/pages';
 * import { routes } from './idioma/.generated/routes';
 *
 * function Navigation() {
 *   const aboutPath = useLocalizedPath('/about', routes);
 *
 *   return (
 *     <nav>
 *       <Link href="/about" routes={routes}>About</Link>
 *       <Link href="/blog" routes={routes}>Blog</Link>
 *     </nav>
 *   );
 * }
 * ```
 */

export { Link, type PagesLinkProps } from './link.js';
export { useLocalizedPath } from './hooks.js';
