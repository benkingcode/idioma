import { expect, test, type Page } from '@playwright/test';

interface ChunkRequest {
  url: string;
  timestamp: number;
}

/**
 * Helper to track which translation chunks are loaded via network requests.
 * In suspense mode, each page has separate chunk files per locale.
 *
 * Production build pattern: index.lazy_jMjUfDEF.en-NqVrQxf0.js
 */
async function trackChunkLoads(page: Page): Promise<ChunkRequest[]> {
  const loadedChunks: ChunkRequest[] = [];

  await page.route('**/*', async (route) => {
    const url = route.request().url();

    // Track translation chunk requests
    // Production pattern: {name}.lazy_{hash}.{locale}-{viteHash}.js
    // e.g., index.lazy_jMjUfDEF.en-NqVrQxf0.js
    if (/\.(en|es)-[A-Za-z0-9_-]+\.js$/.test(url)) {
      loadedChunks.push({
        url,
        timestamp: Date.now(),
      });
    }

    await route.continue();
  });

  return loadedChunks;
}

/**
 * Extract chunk name from URL.
 * e.g., "/assets/index.lazy_jMjUfDEF.en-NqVrQxf0.js" -> "index.lazy"
 */
function getChunkName(url: string): string {
  // Match production pattern: {name}.lazy_{hash}.{locale}-{viteHash}.js
  const match = url.match(
    /\/([^/]+?)_[A-Za-z0-9_-]+\.(en|es)-[A-Za-z0-9_-]+\.js/,
  );
  return match ? match[1] : url;
}

test.describe('Tree Shaking - Suspense Mode', () => {
  test('only loads home page chunks on initial load', async ({ page }) => {
    const loadedChunks = await trackChunkLoads(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify home page content is displayed
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('home-title')).toContainText('Welcome');

    // Check which chunks were loaded
    const chunkNames = loadedChunks.map((c) => getChunkName(c.url));

    // Should have loaded index chunks (home page)
    expect(chunkNames.some((name) => name.includes('index'))).toBe(true);

    // Should NOT have loaded about or contact chunks
    expect(chunkNames.some((name) => name.includes('about'))).toBe(false);
    expect(chunkNames.some((name) => name.includes('contact'))).toBe(false);
  });

  test('loads about page chunks only when navigating to about', async ({
    page,
  }) => {
    const loadedChunks = await trackChunkLoads(page);

    // Start on home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chunksBeforeNav = loadedChunks.length;

    // Navigate to about page
    await page.getByTestId('nav-about').click();
    await expect(page.getByTestId('about-page')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // New chunks should have been loaded
    const newChunks = loadedChunks.slice(chunksBeforeNav);
    const newChunkNames = newChunks.map((c) => getChunkName(c.url));

    // Should have loaded about chunks
    expect(newChunkNames.some((name) => name.includes('about'))).toBe(true);

    // Should NOT have loaded contact chunks
    expect(newChunkNames.some((name) => name.includes('contact'))).toBe(false);
  });

  test('chunks are cached and not re-requested on revisit', async ({
    page,
  }) => {
    const loadedChunks = await trackChunkLoads(page);

    // Visit home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const homeChunkCount = loadedChunks.filter((c) =>
      getChunkName(c.url).includes('index'),
    ).length;

    // Navigate away and back
    await page.getByTestId('nav-about').click();
    await expect(page.getByTestId('about-page')).toBeVisible();

    await page.getByTestId('nav-home').click();
    await expect(page.getByTestId('home-page')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Home chunks should not be re-requested (browser cache + suspense cache)
    const finalHomeChunkCount = loadedChunks.filter((c) =>
      getChunkName(c.url).includes('index'),
    ).length;

    expect(finalHomeChunkCount).toBe(homeChunkCount);
  });

  test('locale switch renders correct translations', async ({ page }) => {
    // Note: We don't test network requests here because browser caching
    // and chunk preloading can make the network behavior unpredictable.
    // Instead, we verify the user-facing behavior works correctly.

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should display English translations
    await expect(page.getByTestId('home-title')).toContainText('Welcome');

    // Switch to Spanish
    await page.getByTestId('locale-selector').selectOption('es');

    // Should now display Spanish translations
    await expect(page.getByTestId('home-title')).toContainText('Bienvenido');

    // Navigate to about page - should stay in Spanish
    await page.getByTestId('nav-about').click();
    await expect(page.getByTestId('about-title')).toContainText('Acerca de');

    // Switch back to English
    await page.getByTestId('locale-selector').selectOption('en');
    await expect(page.getByTestId('about-title')).toContainText('About');
  });

  test('navigating to multiple pages loads chunks incrementally', async ({
    page,
  }) => {
    const loadedChunks = await trackChunkLoads(page);

    // Visit all pages in sequence
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('nav-about').click();
    await expect(page.getByTestId('about-page')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('nav-contact').click();
    await expect(page.getByTestId('contact-page')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // All three page chunks should now be loaded
    const chunkNames = [
      ...new Set(loadedChunks.map((c) => getChunkName(c.url))),
    ];

    expect(chunkNames.some((name) => name.includes('index'))).toBe(true);
    expect(chunkNames.some((name) => name.includes('about'))).toBe(true);
    expect(chunkNames.some((name) => name.includes('contact'))).toBe(true);
  });
});
