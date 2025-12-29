import { expect, test } from '@playwright/test';

test.describe('Routing Hooks - Non-Localized Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests');
  });

  test.describe('useLocalizedPath()', () => {
    test('returns untranslated path in default locale', async ({ page }) => {
      // In English, paths should not be translated
      await expect(page.getByTestId('path-about')).toHaveText('/about');
      await expect(page.getByTestId('path-blog')).toHaveText('/blog');
      await expect(page.getByTestId('path-contact')).toHaveText('/contact');
    });

    test('returns untranslated path even in Spanish locale', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Non-localized: paths should NOT be translated (stays /about, not /sobre)
      await expect(page.getByTestId('path-about')).toHaveText('/about');
      await expect(page.getByTestId('path-blog')).toHaveText('/blog');
      await expect(page.getByTestId('path-contact')).toHaveText('/contact');
    });
  });

  test.describe('useLocalizedHref()', () => {
    test('returns path without prefix for default locale', async ({ page }) => {
      // English (default) should have no prefix
      await expect(page.getByTestId('href-about')).toHaveText('/about');
      await expect(page.getByTestId('href-blog')).toHaveText('/blog');
      await expect(page.getByTestId('href-contact')).toHaveText('/contact');
    });

    test('returns untranslated path with prefix for non-default locale', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Spanish should have prefix but NOT translated paths
      await expect(page.getByTestId('href-about')).toHaveText('/es/about');
      await expect(page.getByTestId('href-blog')).toHaveText('/es/blog');
      await expect(page.getByTestId('href-contact')).toHaveText('/es/contact');
    });
  });
});
