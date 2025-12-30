import { expect, test } from '@playwright/test';

test.describe('LocaleHead SEO - Localized Paths', () => {
  test('renders canonical link on home page', async ({ page, baseURL }) => {
    await page.goto('/');

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', `${baseURL}/`);
  });

  test('renders hreflang for all locales', async ({ page, baseURL }) => {
    await page.goto('/');

    // Check for English hreflang
    const enHreflang = page.locator('link[hreflang="en"]');
    await expect(enHreflang).toHaveAttribute('href', `${baseURL}/`);

    // Check for Spanish hreflang with localized path
    const esHreflang = page.locator('link[hreflang="es"]');
    await expect(esHreflang).toHaveAttribute('href', `${baseURL}/es`);

    // Check for x-default hreflang
    const xDefaultHreflang = page.locator('link[hreflang="x-default"]');
    await expect(xDefaultHreflang).toHaveAttribute('href', `${baseURL}/`);
  });

  test('generates localized hrefs for Spanish about page', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/es/sobre');

    // Canonical should point to current (Spanish) page
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', `${baseURL}/es/sobre`);

    // English hreflang should point to untranslated path
    const enHreflang = page.locator('link[hreflang="en"]');
    await expect(enHreflang).toHaveAttribute('href', `${baseURL}/about`);

    // Spanish hreflang should point to localized path
    const esHreflang = page.locator('link[hreflang="es"]');
    await expect(esHreflang).toHaveAttribute('href', `${baseURL}/es/sobre`);
  });

  test('updates head tags when locale changes', async ({ page, baseURL }) => {
    await page.goto('/about');

    // Start with English canonical
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${baseURL}/about`,
    );

    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es\/sobre/);

    // Canonical should update to Spanish
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${baseURL}/es/sobre`,
    );
  });
});
