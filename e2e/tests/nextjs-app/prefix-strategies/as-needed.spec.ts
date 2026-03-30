import { expect, test } from '@playwright/test';

/**
 * Tests specific to the 'as-needed' prefix strategy.
 *
 * as-needed behavior:
 * - Default locale (en) has NO prefix: / not /en/
 * - Non-default locales (es) have prefix: /es/
 * - Visiting /en/ should redirect to / (strip prefix for default)
 */
test.describe('Prefix Strategy: as-needed', () => {
  test.describe('Default Locale (No Prefix)', () => {
    test('home page accessible without locale prefix', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
      // URL should NOT have /en prefix
      expect(page.url()).not.toMatch(/\/en\//);
      expect(page.url()).not.toMatch(/\/en$/);
    });

    test('about page accessible without locale prefix', async ({ page }) => {
      await page.goto('/about');
      await expect(page.getByTestId('about-title')).toContainText('About');
      // URL should NOT have /en prefix
      expect(page.url()).not.toMatch(/\/en\//);
    });

    test('strips default locale prefix from URL', async ({ page }) => {
      // Visit /en/ - should redirect to /
      await page.goto('/en');
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    });

    test('strips default locale prefix from subpages', async ({ page }) => {
      // Visit /en/about - should redirect to /about
      await page.goto('/en/about');
      await expect(page).toHaveURL(/\/about$/);
      expect(page.url()).not.toMatch(/\/en\//);
    });
  });

  test.describe('Non-Default Locale (With Prefix)', () => {
    test('Spanish home requires /es prefix', async ({ page }) => {
      await page.goto('/es');
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('Spanish about page uses /es prefix with localized path', async ({
      page,
    }) => {
      await page.goto('/es/sobre');
      await expect(page.getByTestId('about-title')).toContainText(
        'Acerca de nuestra empresa',
      );
    });

    test('switching to Spanish adds prefix', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-es').click();
      await expect(page).toHaveURL(/\/es/);
    });

    test('switching to English removes prefix', async ({ page }) => {
      await page.goto('/es');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-en').click();
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    });
  });

  test.describe('Link Href Generation', () => {
    test('links to default locale have no prefix', async ({ page }) => {
      await page.goto('/');

      const homeLink = page.getByTestId('nav-home');
      const href = await homeLink.getAttribute('href');

      // Should be / not /en/
      expect(href).toBe('/');
    });

    test('links in Spanish locale include /es prefix', async ({ page }) => {
      await page.goto('/es');

      const aboutLink = page.getByTestId('nav-about');
      const href = await aboutLink.getAttribute('href');

      // Should include /es and use localized path
      expect(href).toMatch(/^\/es\//);
    });
  });
});
