import { createRouter } from '@tanstack/react-router';
import { delocalizeUrl, localizeUrl } from './idiomi';
import { routeTree } from './routeTree.gen';

/**
 * Router configured with URL rewriting for localized paths.
 *
 * - rewrite.input: transforms localized URLs (/es/sobre) to canonical (/es/about) for matching
 * - rewrite.output: transforms canonical URLs (/es/about) to localized (/es/sobre) for display
 */
export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    rewrite: {
      input: ({ url }) => delocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
