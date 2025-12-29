import { expect, test } from '@playwright/test';

test.describe('LocaleHead SEO - Localized Paths', () => {
  test('renders canonical link on home page', async ({ page }) => {
    await page.goto('/');

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', 'http://localhost:5177/');
  });

  test('renders hreflang for all locales', async ({ page }) => {
    await page.goto('/');

    // Check for English hreflang
    const enHreflang = page.locator('link[hreflang="en"]');
    await expect(enHreflang).toHaveAttribute('href', 'http://localhost:5177/');

    // Check for Spanish hreflang with localized path
    const esHreflang = page.locator('link[hreflang="es"]');
    await expect(esHreflang).toHaveAttribute(
      'href',
      'http://localhost:5177/es',
    );

    // Check for x-default hreflang
    const xDefaultHreflang = page.locator('link[hreflang="x-default"]');
    await expect(xDefaultHreflang).toHaveAttribute(
      'href',
      'http://localhost:5177/',
    );
  });

  test('generates localized hrefs for Spanish about page', async ({ page }) => {
    await page.goto('/es/sobre');

    // Canonical should point to current (Spanish) page
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute(
      'href',
      'http://localhost:5177/es/sobre',
    );

    // English hreflang should point to untranslated path
    const enHreflang = page.locator('link[hreflang="en"]');
    await expect(enHreflang).toHaveAttribute(
      'href',
      'http://localhost:5177/about',
    );

    // Spanish hreflang should point to localized path
    const esHreflang = page.locator('link[hreflang="es"]');
    await expect(esHreflang).toHaveAttribute(
      'href',
      'http://localhost:5177/es/sobre',
    );
  });

  test('updates head tags when locale changes', async ({ page }) => {
    await page.goto('/about');

    // Start with English canonical
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://localhost:5177/about',
    );

    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es\/sobre/);

    // Canonical should update to Spanish
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://localhost:5177/es/sobre',
    );
  });
});
