import { createRouter } from '@tanstack/react-router';
import { localizeUrl } from './idiomi';
import { routeTree } from './routeTree.gen';

/**
 * Router with prefix stripping for default locale.
 *
 * With localizedPaths: false, paths are not translated.
 * /about stays /about regardless of locale.
 *
 * But with prefixStrategy: 'as-needed', the default locale (en) should NOT
 * have a URL prefix. The rewrite.output function strips /en from URLs.
 */
export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    rewrite: {
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
