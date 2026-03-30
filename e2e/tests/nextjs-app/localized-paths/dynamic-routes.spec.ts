import { expect, test } from '@playwright/test';

/**
 * Next.js Dynamic Routes E2E Tests for Localized Paths
 *
 * These tests verify pattern matching functionality for Next.js:
 * 1. Middleware URL rewriting for localized dynamic routes
 * 2. Link component localizing string hrefs with dynamic segments
 * 3. LocaleHead generating correct hreflang for dynamic routes
 *
 * IMPORTANT: These tests define expected behavior. If a test fails,
 * it reveals an implementation bug to be fixed later.
 */

test.describe('Next.js Dynamic Routes - Localized Paths', () => {
  test.describe('Middleware URL Rewriting', () => {
    test('rewrites localized dynamic route to canonical', async ({ page }) => {
      // Request /es/articulos/mi-post should internally rewrite to /es/blog/mi-post
      // and render the blog post page with slug "mi-post"
      await page.goto('/es/articulos/mi-post');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toContainText('mi-post');
    });

    test('canonical path still works', async ({ page }) => {
      // Direct access to /blog/hello should work in English
      await page.goto('/blog/hello-world');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toContainText(
        'hello-world',
      );
    });

    test('localized static route rewrites correctly', async ({ page }) => {
      // /es/articulos (static) should rewrite to /es/blog
      await page.goto('/es/articulos');

      await expect(page.getByTestId('blog-page')).toBeVisible();
    });
  });

  test.describe('Link Component Localization', () => {
    test('string href localizes dynamic route in Spanish', async ({ page }) => {
      // Navigate to Spanish blog list
      await page.goto('/es/articulos');

      // Link with href="/blog/hello-world" should render as /es/articulos/hello-world
      const link = page.getByTestId('blog-post-link-hello');
      await expect(link).toHaveAttribute('href', '/es/articulos/hello-world');
    });

    test('string href stays canonical in English', async ({ page }) => {
      // Navigate to English blog list
      await page.goto('/blog');

      // Link with href="/blog/hello-world" should stay as /blog/hello-world
      const link = page.getByTestId('blog-post-link-hello');
      await expect(link).toHaveAttribute('href', '/blog/hello-world');
    });

    test('clicking localized link navigates correctly', async ({ page }) => {
      await page.goto('/es/articulos');

      await page.getByTestId('blog-post-link-hello').click();

      // Should navigate to Spanish localized URL
      await expect(page).toHaveURL(/\/es\/articulos\/hello-world$/);
      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toContainText(
        'hello-world',
      );
    });
  });

  test.describe('LocaleHead hreflang Generation', () => {
    test('generates correct hreflang for dynamic route in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/articulos/test-post');

      // Wait for page to be fully loaded
      await expect(page.getByTestId('blog-post-page')).toBeVisible();

      // Check hreflang links in head
      // English version should point to /blog/test-post
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/blog\/test-post$/);

      // Spanish version should point to /es/articulos/test-post
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute(
        'href',
        /\/es\/articulos\/test-post$/,
      );
    });

    test('generates correct hreflang for dynamic route in English', async ({
      page,
    }) => {
      await page.goto('/blog/another-post');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();

      // English version should point to /blog/another-post (no prefix for default locale)
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/blog\/another-post$/);

      // Spanish version should point to /es/articulos/another-post
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute(
        'href',
        /\/es\/articulos\/another-post$/,
      );
    });
  });

  test.describe('Direct URL Access', () => {
    test('direct access to English dynamic route works', async ({ page }) => {
      await page.goto('/blog/test-slug');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toContainText(
        'test-slug',
      );
    });

    test('direct access to Spanish dynamic route works', async ({ page }) => {
      await page.goto('/es/articulos/test-slug');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toContainText(
        'test-slug',
      );
      // Verify locale param is 'es'
      await expect(page.getByTestId('blog-post-locale')).toContainText('es');
    });
  });
});
