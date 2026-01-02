import { expect, test } from '@playwright/test';

/**
 * Next.js Static Routes E2E Tests for Non-Localized Paths
 *
 * These tests verify that static routes work correctly with non-localized paths
 * (prefix-only, no path translation):
 * 1. Direct URL access to prefixed paths (e.g., /es/about, not /es/sobre)
 * 2. Translations display correctly based on locale
 * 3. URL structure maintains canonical paths with locale prefix
 */

test.describe('Next.js Static Routes - Non-Localized Paths', () => {
  test.describe('Direct URL Access', () => {
    test('home page renders in English at root', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('home-page')).toBeVisible();
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });

    test('home page renders in Spanish at /es', async ({ page }) => {
      await page.goto('/es');

      await expect(page.getByTestId('home-page')).toBeVisible();
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('about page renders in English at /about', async ({ page }) => {
      await page.goto('/about');

      await expect(page.getByTestId('about-page')).toBeVisible();
      await expect(page.getByTestId('about-title')).toContainText(
        'About our company',
      );
    });

    test('about page renders in Spanish at /es/about (not /es/sobre)', async ({
      page,
    }) => {
      await page.goto('/es/about');

      await expect(page.getByTestId('about-page')).toBeVisible();
      await expect(page.getByTestId('about-title')).toContainText(
        'Acerca de nuestra empresa',
      );
    });

    test('blog page renders in Spanish at /es/blog (not /es/articulos)', async ({
      page,
    }) => {
      await page.goto('/es/blog');

      await expect(page.getByTestId('blog-page')).toBeVisible();
      await expect(page.getByTestId('blog-title')).toContainText(
        'Nuestro Blog',
      );
    });

    test('contact page renders in Spanish at /es/contact (not /es/contacto)', async ({
      page,
    }) => {
      await page.goto('/es/contact');

      await expect(page.getByTestId('contact-page')).toBeVisible();
      await expect(page.getByTestId('contact-title')).toContainText(
        'Contáctenos',
      );
    });
  });

  test.describe('URL Structure - Prefix Only', () => {
    test('Spanish routes use canonical paths with /es prefix', async ({
      page,
    }) => {
      await page.goto('/es');

      await page.getByTestId('nav-about').click();

      // Should navigate to /es/about (not localized /es/sobre)
      await expect(page).toHaveURL(/\/es\/about$/);
      await expect(page.getByTestId('about-page')).toBeVisible();
    });

    test('Spanish blog link uses canonical path', async ({ page }) => {
      await page.goto('/es');

      await page.getByTestId('nav-blog').click();

      // Should navigate to /es/blog (not localized /es/articulos)
      await expect(page).toHaveURL(/\/es\/blog$/);
    });
  });

  test.describe('Never Prefix Strategy', () => {
    test('default locale has no prefix at root', async ({ page }, testInfo) => {
      test.skip(
        !testInfo.project.name.includes('never'),
        'Only runs for never prefix strategy',
      );

      await page.goto('/');

      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
      await expect(page.getByTestId('home-page')).toBeVisible();
    });

    test('non-default locale also has no prefix', async ({
      page,
    }, testInfo) => {
      test.skip(
        !testInfo.project.name.includes('never'),
        'Only runs for never prefix strategy',
      );

      // With never strategy, even Spanish should be at root
      // Locale is determined by cookie or Accept-Language header
      await page.goto('/');

      // Should render without any prefix
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    });
  });
});
