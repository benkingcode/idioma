import { createRouter } from '@tanstack/react-router';
import { deLocalizeUrl, localizeUrl } from './idiomi';
import { routeTree } from './routeTree.gen';

/**
 * Router configured with URL rewriting for localized paths.
 *
 * - rewrite.input: transforms localized URLs (/es/sobre) to canonical (/es/about) for matching
 * - rewrite.output: transforms canonical URLs (/es/about) to localized (/es/sobre) for display
 */
export const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => deLocalizeUrl(url),
    output: ({ url }) => localizeUrl(url),
  },
});
