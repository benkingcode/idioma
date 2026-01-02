import { expect, test } from '@playwright/test';

test.describe('Dynamic Routes - Localized Paths', () => {
  test.describe('Basic Dynamic Route', () => {
    test('dynamic route matches with param in English', async ({ page }) => {
      await page.goto('/blog/hello-world');

      // Should render blog post page
      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toHaveText(
        'hello-world',
      );
    });

    test('dynamic route matches with localized path in Spanish', async ({
      page,
    }) => {
      // articulos is the Spanish translation of blog
      await page.goto('/es/articulos/hello-world');

      // Should render blog post page in Spanish
      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toHaveText(
        'hello-world',
      );
      await expect(page.getByTestId('blog-post-title')).toContainText(
        'Artículo del Blog',
      );
    });

    test('slug parameter is accessible in component', async ({ page }) => {
      await page.goto('/blog/my-custom-slug');

      await expect(page.getByTestId('blog-post-slug')).toHaveText(
        'my-custom-slug',
      );
    });
  });

  test.describe('Navigation to Dynamic Routes', () => {
    test('link to dynamic route works from blog list', async ({ page }) => {
      await page.goto('/blog');

      // Click on a blog post link
      await page.getByTestId('blog-post-link-hello').click();

      // Should navigate to blog post
      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toHaveText(
        'hello-world',
      );
    });

    test('Spanish link to dynamic route uses localized path', async ({
      page,
    }) => {
      await page.goto('/es');

      // Navigate to blog
      await page.getByTestId('nav-blog').click();

      // Click on a blog post link
      await page.getByTestId('blog-post-link-hello').click();

      // URL should use localized path
      await expect(page).toHaveURL(/\/es\/articulos\/hello-world$/);
      await expect(page.getByTestId('blog-post-page')).toBeVisible();
    });
  });

  test.describe('Browser History with Dynamic Routes', () => {
    test('browser back works from dynamic route', async ({ page }) => {
      await page.goto('/blog');

      // Navigate to blog post
      await page.getByTestId('blog-post-link-hello').click();
      await expect(page.getByTestId('blog-post-page')).toBeVisible();

      // Go back
      await page.goBack();

      // Should be back on blog list
      await expect(page.getByTestId('blog-page')).toBeVisible();
    });

    test('browser forward works to dynamic route', async ({ page }) => {
      await page.goto('/blog');

      // Navigate to blog post
      await page.getByTestId('blog-post-link-hello').click();
      await expect(page.getByTestId('blog-post-page')).toBeVisible();

      // Go back
      await page.goBack();
      await expect(page.getByTestId('blog-page')).toBeVisible();

      // Go forward
      await page.goForward();
      await expect(page.getByTestId('blog-post-page')).toBeVisible();
    });
  });

  test.describe('Direct URL Access', () => {
    test('direct access to English dynamic route works', async ({ page }) => {
      await page.goto('/blog/test-post');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toHaveText('test-post');
    });

    test('direct access to Spanish dynamic route works', async ({ page }) => {
      await page.goto('/es/articulos/test-post');

      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toHaveText('test-post');
      await expect(page.getByTestId('blog-post-title')).toContainText(
        'Artículo del Blog',
      );
    });
  });
});
