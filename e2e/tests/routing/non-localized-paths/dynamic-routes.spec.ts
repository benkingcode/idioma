import { expect, test } from '@playwright/test';

test.describe('Dynamic Routes - Non-Localized Paths', () => {
  test('dynamic route uses prefix only, not translated path', async ({
    page,
  }) => {
    // Navigate to Spanish blog
    await page.goto('/es/blog');

    // Blog post link should use /es/blog, NOT /es/articulos
    await expect(page.getByTestId('blog-post-link-hello')).toHaveAttribute(
      'href',
      /\/es\/blog\/hello-world$/,
    );
  });

  test('Spanish dynamic route accessed via untranslated path', async ({
    page,
  }) => {
    // In non-localized mode, use /es/blog, not /es/articulos
    await page.goto('/es/blog/hello-world');

    // Should render blog post page in Spanish
    await expect(page.getByTestId('blog-post-page')).toBeVisible();
    await expect(page.getByTestId('blog-post-slug')).toHaveText('hello-world');
    await expect(page.getByTestId('blog-post-title')).toContainText(
      'Artículo del Blog',
    );
  });

  test('navigation to dynamic route uses prefix only', async ({ page }) => {
    await page.goto('/es/blog');

    // Click on a blog post link
    await page.getByTestId('blog-post-link-hello').click();

    // URL should use prefix only (not translated)
    await expect(page).toHaveURL(/\/es\/blog\/hello-world$/);
    await expect(page.getByTestId('blog-post-page')).toBeVisible();
  });
});
