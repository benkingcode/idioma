import {
  createStartHandler,
  defaultStreamHandler,
  defineHandlerCallback,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import { handleLocaleRequest } from './idiomi';

/**
 * Custom server handler that integrates locale detection and URL rewriting.
 *
 * This runs before TanStack Router processes the request, allowing us to:
 * 1. Detect locale from Accept-Language headers and cookies
 * 2. Redirect to add/strip locale prefixes based on prefixStrategy
 * 3. Rewrite URLs internally for routing (prefixStrategy: 'never')
 * 4. Sync locale cookies for subsequent requests
 */
const customHandler = defineHandlerCallback(async (ctx) => {
  const { redirectUrl, rewrittenUrl, setCookie } = handleLocaleRequest(
    ctx.request,
  );

  // Handle redirects (e.g., /en/about → /about for as-needed strategy)
  if (redirectUrl) {
    const headers = new Headers();
    headers.set('Location', redirectUrl);
    if (setCookie) {
      headers.set('Set-Cookie', setCookie);
    }
    return new Response(null, {
      status: 302,
      headers,
    });
  }

  // Handle URL rewrites (e.g., /about → /es/about for prefixStrategy: 'never')
  const effectiveRequest = rewrittenUrl
    ? new Request(rewrittenUrl, ctx.request)
    : ctx.request;

  // Process the request with TanStack Start's default handler
  const response = await defaultStreamHandler({
    ...ctx,
    request: effectiveRequest,
  });

  // Sync locale cookie if needed
  if (setCookie) {
    response.headers.append('Set-Cookie', setCookie);
  }

  return response;
});

const fetch = createStartHandler(customHandler);

export default createServerEntry({
  fetch,
});
