import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Tree shaking tests for non-Suspense mode.
 *
 * In standard mode, translations are inlined by Babel directly into components.
 * Each `<Trans>Hello</Trans>` becomes `<__Trans __t={{ en: "Hello", es: "Hola" }} />`
 *
 * Tree shaking happens at the KEY level:
 * - Each route's bundle only contains translation keys used by that route
 * - Keys for other routes are NOT included in the bundle
 *
 * We verify this by analyzing the production build output.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '../../fixtures/tree-shaking-standard');
const DIST_DIR = join(FIXTURE_DIR, 'dist/assets');

interface JSChunkRequest {
  url: string;
  timestamp: number;
}

async function trackJSChunks(page: Page): Promise<JSChunkRequest[]> {
  const loadedChunks: JSChunkRequest[] = [];

  await page.route('**/*.js', async (route) => {
    const url = route.request().url();

    // Track lazy-loaded route chunks
    if (url.includes('/assets/')) {
      loadedChunks.push({
        url,
        timestamp: Date.now(),
      });
    }

    await route.continue();
  });

  return loadedChunks;
}

test.describe('Tree Shaking - Standard Mode', () => {
  test('translations work correctly across lazy-loaded routes', async ({
    page,
  }) => {
    await page.goto('/');

    // Home page translations
    await expect(page.getByTestId('home-title')).toContainText('Welcome');

    // Navigate and verify about page translations
    await page.getByTestId('nav-about').click();
    await expect(page.getByTestId('about-title')).toContainText('About');

    // Navigate and verify contact page translations
    await page.getByTestId('nav-contact').click();
    await expect(page.getByTestId('contact-title')).toContainText(
      'Get in touch',
    );
  });

  test('locale switching works across lazy routes', async ({ page }) => {
    await page.goto('/');

    // English
    await expect(page.getByTestId('home-title')).toContainText('Welcome');

    // Switch to Spanish
    await page.getByTestId('locale-selector').selectOption('es');
    await expect(page.getByTestId('home-title')).toContainText('Bienvenido');

    // Navigate to about - Spanish should persist
    await page.getByTestId('nav-about').click();
    await expect(page.getByTestId('about-title')).toContainText('Acerca de');
  });

  test('route bundles only contain their own translation keys', async () => {
    // In standard mode, Babel should inline translations directly into each
    // component at the call site, NOT import from a shared translations object.
    // This enables tree shaking at the KEY level - each route's bundle should
    // only contain the translation keys used by that route.

    const files = readdirSync(DIST_DIR);
    const jsFiles = files.filter((f) => f.endsWith('.js'));

    // Unique translation strings that identify each page:
    // - Home: "Welcome to our website"
    // - About: "About our company"
    // - Contact: "Get in touch with us"

    const homeMarker = 'Welcome to our website';
    const aboutMarker = 'About our company';
    const contactMarker = 'Get in touch with us';

    let homeChunk: string | null = null;
    let aboutChunk: string | null = null;
    let contactChunk: string | null = null;

    for (const file of jsFiles) {
      const content = readFileSync(join(DIST_DIR, file), 'utf-8');

      if (content.includes(homeMarker)) {
        homeChunk = file;
        // Home chunk should NOT contain about or contact translations
        expect(content).not.toContain(aboutMarker);
        expect(content).not.toContain(contactMarker);
      }

      if (content.includes(aboutMarker)) {
        aboutChunk = file;
        // About chunk should NOT contain home or contact translations
        expect(content).not.toContain(homeMarker);
        expect(content).not.toContain(contactMarker);
      }

      if (content.includes(contactMarker)) {
        contactChunk = file;
        // Contact chunk should NOT contain home or about translations
        expect(content).not.toContain(homeMarker);
        expect(content).not.toContain(aboutMarker);
      }
    }

    // All three chunks should exist and be separate files
    expect(homeChunk).not.toBeNull();
    expect(aboutChunk).not.toBeNull();
    expect(contactChunk).not.toBeNull();

    // They should be different files (tree-shaken into separate chunks)
    expect(homeChunk).not.toBe(aboutChunk);
    expect(homeChunk).not.toBe(contactChunk);
    expect(aboutChunk).not.toBe(contactChunk);
  });

  test('each translation key includes all locales inline', async () => {
    // Read the production build output
    const files = readdirSync(DIST_DIR);
    const jsFiles = files.filter((f) => f.endsWith('.js'));

    // Find a chunk with translations and verify it has all locales
    for (const file of jsFiles) {
      const content = readFileSync(join(DIST_DIR, file), 'utf-8');

      // If this chunk has English "Welcome", it should also have Spanish
      if (content.includes('Welcome to our website')) {
        expect(content).toContain('Bienvenido');
        break;
      }
    }
  });

  test('route components are code-split with lazy loading', async ({
    page,
  }) => {
    const loadedChunks = await trackJSChunks(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chunksAfterHome = loadedChunks.length;

    // Navigate to about
    await page.getByTestId('nav-about').click();
    await expect(page.getByTestId('about-page')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Should have loaded additional JS chunks for the about route
    expect(loadedChunks.length).toBeGreaterThan(chunksAfterHome);
  });
});
