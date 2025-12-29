import { expect, test } from '@playwright/test';

test.describe('Explicit Locale Links - Localized Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests');
  });

  test.describe('Context Locale Links', () => {
    test('links use current locale from context', async ({ page }) => {
      // In English context, links should point to English paths
      await expect(page.getByTestId('link-about')).toHaveAttribute(
        'href',
        '/about',
      );
      await expect(page.getByTestId('link-blog')).toHaveAttribute(
        'href',
        '/blog',
      );
    });

    test('links update when context locale changes', async ({ page }) => {
      // Switch to Spanish
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Links should now point to Spanish localized paths
      await expect(page.getByTestId('link-about')).toHaveAttribute(
        'href',
        '/es/sobre',
      );
      await expect(page.getByTestId('link-blog')).toHaveAttribute(
        'href',
        '/es/articulos',
      );
    });
  });

  test.describe('Explicit Locale Override', () => {
    test('explicit EN link always shows English path', async ({ page }) => {
      // Even in default English, explicit EN link should work
      await expect(page.getByTestId('link-about-en')).toHaveAttribute(
        'href',
        '/about',
      );
    });

    test('explicit ES link always shows Spanish localized path', async ({
      page,
    }) => {
      // From English context, explicit ES link should show Spanish path
      await expect(page.getByTestId('link-about-es')).toHaveAttribute(
        'href',
        '/es/sobre',
      );
      await expect(page.getByTestId('link-blog-es')).toHaveAttribute(
        'href',
        '/es/articulos',
      );
    });

    test('explicit links work from Spanish context', async ({ page }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Explicit EN should still show English path
      await expect(page.getByTestId('link-about-en')).toHaveAttribute(
        'href',
        '/about',
      );

      // Explicit ES should still show Spanish path
      await expect(page.getByTestId('link-about-es')).toHaveAttribute(
        'href',
        '/es/sobre',
      );
    });
  });

  test.describe('Language Switcher Pattern', () => {
    test('switcher links point to correct locale versions', async ({
      page,
    }) => {
      await expect(page.getByTestId('switcher-en')).toHaveAttribute(
        'href',
        '/about',
      );
      await expect(page.getByTestId('switcher-es')).toHaveAttribute(
        'href',
        '/es/sobre',
      );
    });

    test('clicking switcher navigates to correct locale', async ({ page }) => {
      // Click Spanish switcher
      await page.getByTestId('switcher-es').click();

      // Should navigate to Spanish about page
      await expect(page).toHaveURL(/\/es\/sobre$/);
      await expect(page.getByTestId('about-page')).toBeVisible();
    });
  });
});
