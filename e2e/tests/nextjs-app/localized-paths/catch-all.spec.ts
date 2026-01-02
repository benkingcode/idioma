import { expect, test } from '@playwright/test';

/**
 * Next.js Catch-All Routes E2E Tests for Localized Paths
 *
 * These tests verify that [...slug] catch-all routes work correctly
 * with localized paths (e.g., /docs/[...slug] -> /documentacion/[...slug]).
 */

test.describe('Next.js Catch-All Routes - Localized Paths', () => {
  test.describe('Direct URL Access', () => {
    test('single segment catch-all works in English', async ({ page }) => {
      await page.goto('/docs/intro');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-title')).toContainText(
        'Documentation',
      );
      await expect(page.getByTestId('docs-slug')).toContainText('Path: /intro');
      await expect(page.getByTestId('docs-locale')).toContainText('Locale: en');
    });

    test('multi-segment catch-all works in English', async ({ page }) => {
      await page.goto('/docs/getting-started/installation');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-slug')).toContainText(
        'Path: /getting-started/installation',
      );
    });

    test('single segment catch-all works in Spanish', async ({ page }) => {
      await page.goto('/es/documentacion/introduccion');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-title')).toContainText(
        'Documentación',
      );
      await expect(page.getByTestId('docs-slug')).toContainText(
        'Path: /introduccion',
      );
      await expect(page.getByTestId('docs-locale')).toContainText('Locale: es');
    });

    test('multi-segment catch-all works in Spanish', async ({ page }) => {
      await page.goto('/es/documentacion/guia/primeros-pasos');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-slug')).toContainText(
        'Path: /guia/primeros-pasos',
      );
    });

    test('deeply nested catch-all works', async ({ page }) => {
      await page.goto('/docs/api/v1/users/create');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-slug')).toContainText(
        'Path: /api/v1/users/create',
      );
    });
  });

  test.describe('Middleware Rewriting', () => {
    test('rewrites localized catch-all to canonical path', async ({ page }) => {
      // /es/documentacion/test should rewrite to /es/docs/test internally
      await page.goto('/es/documentacion/test');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-slug')).toContainText('Path: /test');
    });

    test('preserves all segments in rewrite', async ({ page }) => {
      await page.goto('/es/documentacion/a/b/c/d');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-slug')).toContainText(
        'Path: /a/b/c/d',
      );
    });
  });

  test.describe('LocaleHead hreflang for Catch-All', () => {
    test('generates correct hreflang for catch-all in English', async ({
      page,
    }) => {
      await page.goto('/docs/getting-started');

      await expect(page.getByTestId('docs-page')).toBeVisible();

      // English version should point to /docs/getting-started
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute(
        'href',
        /\/docs\/getting-started$/,
      );

      // Spanish version should point to /es/documentacion/getting-started
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute(
        'href',
        /\/es\/documentacion\/getting-started$/,
      );
    });

    test('generates correct hreflang for catch-all in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/documentacion/guia');

      await expect(page.getByTestId('docs-page')).toBeVisible();

      // English version should point to /docs/guia
      const enHreflang = page.locator('link[rel="alternate"][hreflang="en"]');
      await expect(enHreflang).toHaveAttribute('href', /\/docs\/guia$/);

      // Spanish version should point to /es/documentacion/guia
      const esHreflang = page.locator('link[rel="alternate"][hreflang="es"]');
      await expect(esHreflang).toHaveAttribute(
        'href',
        /\/es\/documentacion\/guia$/,
      );
    });
  });
});
