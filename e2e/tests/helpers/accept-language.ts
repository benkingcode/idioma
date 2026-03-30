import type { Page } from '@playwright/test';

/**
 * Set Accept-Language header using route interception.
 *
 * IMPORTANT: We use route() instead of setExtraHTTPHeaders() because
 * Chrome's built-in Accept-Language header (based on locale) is NOT
 * overridden by setExtraHTTPHeaders(). The route() API intercepts the
 * actual network request and allows us to modify headers reliably.
 *
 * We only intercept document and fetch requests to avoid interfering
 * with WebSocket connections, HMR, and other internal browser traffic.
 */
export async function setAcceptLanguage(
  page: Page,
  acceptLanguage: string,
): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();

    // Only modify document and fetch requests - these are the ones the
    // server uses for Accept-Language detection. Skip other requests
    // (websocket, xhr for HMR, etc.) to avoid connection issues.
    if (resourceType === 'document' || resourceType === 'fetch') {
      const headers = {
        ...request.headers(),
        'accept-language': acceptLanguage,
      };
      await route.continue({ headers });
    } else {
      await route.continue();
    }
  });
}
