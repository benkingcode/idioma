import { expect, test } from '@playwright/test';

/**
 * Next.js LocaleHead E2E Tests for SEO hreflang Tags
 *
 * These tests verify that the LocaleHead component correctly generates
 * hreflang link tags for SEO with proper localized URLs.
 */

test.describe('LocaleHead - hreflang Tags', () => {
  test.describe('Static Routes', () => {
    test('generates correct hreflang for home page in English', async ({
      page,
    }) => {
      await page.goto('/');

      // English version should point to root (no prefix)
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/$/);

      // Spanish version should point to /es
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute('href', /\/es$/);
    });

    test('generates correct hreflang for home page in Spanish', async ({
      page,
    }) => {
      await page.goto('/es');

      // English version should point to root
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/$/);

      // Spanish version should point to /es
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute('href', /\/es$/);
    });

    test('generates correct hreflang for about page in English', async ({
      page,
    }) => {
      await page.goto('/about');

      // English version should point to /about
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/about$/);

      // Spanish version should point to /es/sobre (localized path)
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute('href', /\/es\/sobre$/);
    });

    test('generates correct hreflang for about page in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/sobre');

      // English version should point to /about
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/about$/);

      // Spanish version should point to /es/sobre
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute('href', /\/es\/sobre$/);
    });

    test('generates correct hreflang for blog page', async ({ page }) => {
      await page.goto('/blog');

      // English version should point to /blog
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/blog$/);

      // Spanish version should point to /es/articulos
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute('href', /\/es\/articulos$/);
    });

    test('generates correct hreflang for contact page', async ({ page }) => {
      await page.goto('/contact');

      // English version should point to /contact
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/contact$/);

      // Spanish version should point to /es/contacto
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute('href', /\/es\/contacto$/);
    });
  });

  test.describe('Dynamic Routes', () => {
    test('generates correct hreflang for blog post in English', async ({
      page,
    }) => {
      await page.goto('/blog/my-post');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();

      // English version should point to /blog/my-post
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/blog\/my-post$/);

      // Spanish version should point to /es/articulos/my-post
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute(
        'href',
        /\/es\/articulos\/my-post$/,
      );
    });

    test('generates correct hreflang for blog post in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/articulos/mi-articulo');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();

      // English version should point to /blog/mi-articulo
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/blog\/mi-articulo$/);

      // Spanish version should point to /es/articulos/mi-articulo
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute(
        'href',
        /\/es\/articulos\/mi-articulo$/,
      );
    });
  });

  test.describe('x-default Tag', () => {
    test('includes x-default pointing to default locale', async ({ page }) => {
      await page.goto('/about');

      // x-default should point to English (default locale) path
      const xDefault = page.locator(
        'link[rel="alternate"][hreflang="x-default"]',
      );
      await expect(xDefault).toHaveAttribute('href', /\/about$/);
    });
  });

  test.describe('Canonical Tag', () => {
    test('canonical matches current URL for English page', async ({ page }) => {
      await page.goto('/about');

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', /\/about$/);
    });

    test('canonical matches current URL for Spanish page', async ({ page }) => {
      await page.goto('/es/sobre');

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', /\/es\/sobre$/);
    });
  });
});
