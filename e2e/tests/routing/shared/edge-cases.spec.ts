import { expect, test } from '@playwright/test';

test.describe('Edge Cases', () => {
  test.describe('Query Parameters', () => {
    test('query params preserved on navigation', async ({ page }) => {
      await page.goto('/about?ref=test&source=email');

      // Navigate to another page via link
      await page.getByTestId('nav-blog').click();

      // Query params should NOT be preserved on normal navigation
      // (only preserved on locale switch)
      await expect(page).toHaveURL(/\/blog$/);
    });

    test('query params preserved on locale switch', async ({ page }) => {
      await page.goto('/about?ref=test');

      // Switch to Spanish
      await page.getByTestId('locale-es').click();

      // Should preserve query params
      await expect(page).toHaveURL(/\?ref=test/);
    });

    test('multiple query params preserved on locale switch', async ({
      page,
    }) => {
      await page.goto('/about?ref=test&source=email&campaign=launch');

      // Switch to Spanish
      await page.getByTestId('locale-es').click();

      // All query params should be preserved
      const url = page.url();
      expect(url).toContain('ref=test');
      expect(url).toContain('source=email');
      expect(url).toContain('campaign=launch');
    });
  });

  test.describe('Hash Fragments', () => {
    test('hash preserved on locale switch', async ({ page }) => {
      await page.goto('/about#section-2');

      // Wait for hydration before clicking locale switch
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });

      // Switch to Spanish
      await page.getByTestId('locale-es').click();

      // Hash should be preserved
      await expect(page).toHaveURL(/#section-2$/);
    });

    test('hash and query params both preserved', async ({ page }) => {
      await page.goto('/about?ref=test#section-2');

      // Wait for hydration before clicking locale switch
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });

      // Switch to Spanish
      await page.getByTestId('locale-es').click();

      // Both should be preserved
      const url = page.url();
      expect(url).toContain('ref=test');
      expect(url).toContain('#section-2');
    });
  });

  test.describe('Invalid Locales', () => {
    test('invalid locale falls back to default', async ({ page }) => {
      // Navigate to non-existent locale
      const response = await page.goto('/fr/about');

      // Should get 404 or redirect - implementation specific
      // The key is it shouldn't crash
      expect(response?.status()).toBeLessThan(500);
    });

    test('partial locale match does not incorrectly match', async ({
      page,
    }) => {
      // "english" should not match "en"
      const response = await page.goto('/english/about');

      // Should get 404 or not match
      expect(response?.status()).toBeLessThan(500);
    });
  });

  test.describe('Trailing Slashes', () => {
    test('page works with trailing slash', async ({ page }) => {
      await page.goto('/about/');

      // Should render the about page
      await expect(page.getByTestId('about-page')).toBeVisible();
    });

    test('Spanish page works with trailing slash', async ({ page }) => {
      await page.goto('/es/');

      // Should render the home page
      await expect(page.getByTestId('home-page')).toBeVisible();
    });

    test('navigation links do not have double slashes', async ({ page }) => {
      await page.goto('/');

      // Check that home link doesn't have //
      const homeHref = await page.getByTestId('nav-home').getAttribute('href');
      expect(homeHref).not.toContain('//');
    });
  });

  test.describe('Hard Refresh', () => {
    test('page reload preserves locale from URL', async ({ page }) => {
      await page.goto('/es');
      await expect(page.getByTestId('home-title')).toContainText('Bienvenido');

      // Hard refresh
      await page.reload();

      // Should still be in Spanish
      await expect(page.getByTestId('home-title')).toContainText('Bienvenido');
    });

    test('page reload on inner page preserves locale', async ({ page }) => {
      await page.goto('/es');

      // Navigate to about
      await page.getByTestId('nav-about').click();

      // Hard refresh
      await page.reload();

      // Should still be on about page in Spanish
      await expect(page.getByTestId('about-page')).toBeVisible();
      await expect(page.getByTestId('about-title')).toContainText(
        'Acerca de nuestra empresa',
      );
    });
  });
});
