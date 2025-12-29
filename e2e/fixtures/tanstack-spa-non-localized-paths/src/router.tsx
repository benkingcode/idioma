import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

/**
 * Router without URL rewriting.
 *
 * With localizedPaths: false, paths are not translated.
 * /about stays /about regardless of locale.
 * Only the locale prefix changes: /about → /es/about
 */
export const router = createRouter({
  routeTree,
});
