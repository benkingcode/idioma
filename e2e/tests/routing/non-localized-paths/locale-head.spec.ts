import { expect, test } from '@playwright/test';

test.describe('LocaleHead SEO - Non-Localized Paths', () => {
  test('renders canonical link on home page', async ({ page }) => {
    await page.goto('/');

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', 'http://localhost:5178/');
  });

  test('renders hreflang with untranslated paths', async ({ page }) => {
    await page.goto('/');

    // Check for English hreflang
    const enHreflang = page.locator('link[hreflang="en"]');
    await expect(enHreflang).toHaveAttribute('href', 'http://localhost:5178/');

    // Check for Spanish hreflang - should NOT be translated
    const esHreflang = page.locator('link[hreflang="es"]');
    await expect(esHreflang).toHaveAttribute(
      'href',
      'http://localhost:5178/es',
    );
  });

  test('hreflang uses untranslated paths on about page', async ({ page }) => {
    await page.goto('/about');

    // English hreflang should use /about
    const enHreflang = page.locator('link[hreflang="en"]');
    await expect(enHreflang).toHaveAttribute(
      'href',
      'http://localhost:5178/about',
    );

    // Spanish hreflang should use /es/about (NOT /es/sobre)
    const esHreflang = page.locator('link[hreflang="es"]');
    await expect(esHreflang).toHaveAttribute(
      'href',
      'http://localhost:5178/es/about',
    );
    await expect(esHreflang).not.toHaveAttribute(
      'href',
      'http://localhost:5178/es/sobre',
    );
  });

  test('canonical updates for Spanish locale', async ({ page }) => {
    await page.goto('/es/about');

    // Canonical should point to current page
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute(
      'href',
      'http://localhost:5178/es/about',
    );
  });
});
