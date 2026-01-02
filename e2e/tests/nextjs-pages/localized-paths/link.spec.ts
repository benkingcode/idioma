import { expect, test } from '@playwright/test';

/**
 * Next.js Pages Router Link Component E2E Tests for Localized Paths
 *
 * These tests verify that the Link component correctly generates
 * localized hrefs based on the current locale and route translations.
 */

test.describe('Link Component - Localized Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders links with untranslated paths in default locale', async ({
    page,
  }) => {
    // English (default) should not have prefix (prefixStrategy: 'as-needed')
    await expect(page.getByTestId('nav-home')).toHaveAttribute('href', '/');
    await expect(page.getByTestId('nav-about')).toHaveAttribute(
      'href',
      '/about',
    );
    await expect(page.getByTestId('nav-blog')).toHaveAttribute('href', '/blog');
    await expect(page.getByTestId('nav-contact')).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  test('renders links with localized paths in Spanish locale', async ({
    page,
  }) => {
    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Spanish should use translated paths
    await expect(page.getByTestId('nav-home')).toHaveAttribute('href', '/es');
    await expect(page.getByTestId('nav-about')).toHaveAttribute(
      'href',
      '/es/sobre',
    );
    await expect(page.getByTestId('nav-blog')).toHaveAttribute(
      'href',
      '/es/articulos',
    );
    await expect(page.getByTestId('nav-contact')).toHaveAttribute(
      'href',
      '/es/contacto',
    );
  });

  test('navigates to correct localized URL', async ({ page }) => {
    // Switch to Spanish first
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Click About link
    await page.getByTestId('nav-about').click();

    // Should navigate to localized path
    await expect(page).toHaveURL(/\/es\/sobre$/);
    await expect(page.getByTestId('about-page')).toBeVisible();
  });

  test('direct URL access to localized path works', async ({ page }) => {
    // Navigate directly to Spanish About page
    await page.goto('/es/sobre');

    // Should render the About page in Spanish
    await expect(page.getByTestId('about-page')).toBeVisible();
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('handles dynamic routes with localized paths', async ({ page }) => {
    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Blog link should be translated
    await expect(page.getByTestId('nav-blog')).toHaveAttribute(
      'href',
      '/es/articulos',
    );

    // Click and verify navigation
    await page.getByTestId('nav-blog').click();
    await expect(page).toHaveURL(/\/es\/articulos$/);
  });
});
