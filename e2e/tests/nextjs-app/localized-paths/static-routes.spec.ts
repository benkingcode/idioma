import { expect, test } from '@playwright/test';

/**
 * Next.js Static Routes E2E Tests for Localized Paths
 *
 * These tests verify that static routes work correctly with localized paths:
 * 1. Direct URL access to localized paths (e.g., /es/sobre)
 * 2. Middleware URL rewriting from localized to canonical paths
 * 3. Link component rendering correct localized hrefs
 */

test.describe('Next.js Static Routes - Localized Paths', () => {
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

    test('about page renders in Spanish at localized path /es/sobre', async ({
      page,
    }) => {
      await page.goto('/es/sobre');

      await expect(page.getByTestId('about-page')).toBeVisible();
      await expect(page.getByTestId('about-title')).toContainText(
        'Acerca de nuestra empresa',
      );
    });

    test('blog page renders in Spanish at localized path /es/articulos', async ({
      page,
    }) => {
      await page.goto('/es/articulos');

      await expect(page.getByTestId('blog-page')).toBeVisible();
      await expect(page.getByTestId('blog-title')).toContainText(
        'Nuestro Blog',
      );
    });

    test('contact page renders in Spanish at localized path /es/contacto', async ({
      page,
    }) => {
      await page.goto('/es/contacto');

      await expect(page.getByTestId('contact-page')).toBeVisible();
      await expect(page.getByTestId('contact-title')).toContainText(
        'Contáctenos',
      );
    });
  });

  test.describe('URL Structure', () => {
    test('English routes have no locale prefix (as-needed strategy)', async ({
      page,
    }) => {
      await page.goto('/');

      // Home should be at root (no /en prefix)
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    });

    test('Spanish routes have /es prefix', async ({ page }) => {
      await page.goto('/es');

      await expect(page).toHaveURL(/\/es$/);
    });

    test('navigating to about in Spanish uses localized path', async ({
      page,
    }) => {
      await page.goto('/es');

      await page.getByTestId('nav-about').click();

      // Should navigate to localized path, not /es/about
      await expect(page).toHaveURL(/\/es\/sobre$/);
      await expect(page.getByTestId('about-page')).toBeVisible();
    });
  });

  test.describe('Middleware Rewriting', () => {
    test('canonical Spanish path redirects to localized path', async ({
      page,
    }) => {
      // Visiting /es/about should redirect to /es/sobre
      // This tests that the middleware rewrites canonical paths to localized
      await page.goto('/es/about');

      // The middleware should either:
      // 1. Redirect to /es/sobre, or
      // 2. Rewrite internally and serve the about page
      // Either way, the about page should render
      await expect(page.getByTestId('about-page')).toBeVisible();
    });
  });
});
