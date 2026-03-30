import { expect, test } from '@playwright/test';

test.describe('Routing Hooks - Localized Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests');
  });

  test.describe('useLocale()', () => {
    test('returns current locale', async ({ page }) => {
      // In English (default), locale should be 'en'
      await expect(page.getByTestId('hook-tests')).toContainText(
        'Current locale: en',
      );
    });

    test('updates when locale changes', async ({ page }) => {
      // Switch to Spanish
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Should now show 'es'
      await expect(page.getByTestId('hook-tests')).toContainText(
        'Current locale: es',
      );
    });
  });

  test.describe('useLocalizedPath()', () => {
    test('returns translated path for current locale', async ({ page }) => {
      // In English, paths should not be translated
      await expect(page.getByTestId('path-about')).toHaveText('/about');
      await expect(page.getByTestId('path-blog')).toHaveText('/blog');
      await expect(page.getByTestId('path-contact')).toHaveText('/contact');
    });

    test('returns Spanish paths when locale is Spanish', async ({ page }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Paths should be translated
      await expect(page.getByTestId('path-about')).toHaveText('/sobre');
      await expect(page.getByTestId('path-blog')).toHaveText('/articulos');
      await expect(page.getByTestId('path-contact')).toHaveText('/contacto');
    });
  });

  test.describe('useLocalizedHref()', () => {
    test('returns path without prefix for default locale', async ({ page }) => {
      // English (default) should have no prefix (prefixStrategy: 'as-needed')
      await expect(page.getByTestId('href-about')).toHaveText('/about');
      await expect(page.getByTestId('href-blog')).toHaveText('/blog');
      await expect(page.getByTestId('href-contact')).toHaveText('/contact');
    });

    test('returns localized path with prefix for non-default locale', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Spanish should have prefix AND translated paths
      await expect(page.getByTestId('href-about')).toHaveText('/es/sobre');
      await expect(page.getByTestId('href-blog')).toHaveText('/es/articulos');
      await expect(page.getByTestId('href-contact')).toHaveText('/es/contacto');
    });

    test('locale override returns correct href regardless of current locale', async ({
      page,
    }) => {
      // Even in English, explicit ES should return Spanish path
      await expect(page.getByTestId('href-about-es')).toHaveText('/es/sobre');

      // Even in English, explicit EN should return English path (no prefix)
      await expect(page.getByTestId('href-about-en')).toHaveText('/about');
    });

    test('locale override works from Spanish context', async ({ page }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // From Spanish context, EN override should still give English path
      await expect(page.getByTestId('href-about-en')).toHaveText('/about');

      // From Spanish context, ES override should give Spanish path
      await expect(page.getByTestId('href-about-es')).toHaveText('/es/sobre');
    });
  });
});
