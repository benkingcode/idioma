import { expect, test } from '@playwright/test';

test.describe('Complex Routes - Non-Localized Paths Stress Tests', () => {
  // ============================================
  // SECTION 1: Multiple Static Segments (NO translation)
  // ============================================
  test.describe('Multiple Static Segments', () => {
    test('two static segments work in English', async ({ page }) => {
      await page.goto('/products/featured');

      await expect(page.getByTestId('featured-products-page')).toBeVisible();
      await expect(page).toHaveURL('/products/featured');
    });

    test('two static segments work in Spanish (same paths, just prefix)', async ({
      page,
    }) => {
      // In non-localized mode, paths are NOT translated
      await page.goto('/es/products/featured');

      await expect(page.getByTestId('featured-products-page')).toBeVisible();
      await expect(page.getByTestId('featured-products-title')).toContainText(
        'Productos Destacados',
      );
      // Path stays the same, only prefix changes
      await expect(page).toHaveURL('/es/products/featured');
    });

    test('deeply nested static segments (4 levels) work in English', async ({
      page,
    }) => {
      await page.goto('/docs/api/v2/reference');

      await expect(page.getByTestId('docs-reference-page')).toBeVisible();
      await expect(page).toHaveURL('/docs/api/v2/reference');
    });

    test('deeply nested static segments (4 levels) work in Spanish', async ({
      page,
    }) => {
      // Paths stay the same, no translation
      await page.goto('/es/docs/api/v2/reference');

      await expect(page.getByTestId('docs-reference-page')).toBeVisible();
      await expect(page.getByTestId('docs-reference-title')).toContainText(
        'Referencia de API',
      );
    });
  });

  // ============================================
  // SECTION 2: Multiple Dynamic Params
  // ============================================
  test.describe('Multiple Dynamic Params', () => {
    test('two dynamic params accessible in English', async ({ page }) => {
      await page.goto('/users/john/posts/hello-world');

      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();
      await expect(page.getByTestId('detail-user-id')).toHaveText('john');
      await expect(page.getByTestId('detail-post-id')).toHaveText(
        'hello-world',
      );
    });

    test('two dynamic params accessible in Spanish (paths unchanged)', async ({
      page,
    }) => {
      // /users/john/posts/hello-world stays the same, just add /es prefix
      await page.goto('/es/users/john/posts/hello-world');

      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();
      await expect(page.getByTestId('detail-user-id')).toHaveText('john');
      await expect(page.getByTestId('detail-post-id')).toHaveText(
        'hello-world',
      );
      await expect(page.getByTestId('user-post-detail-title')).toContainText(
        'Detalle',
      );
    });

    test('navigation between pages preserves all dynamic params', async ({
      page,
    }) => {
      await page.goto('/es/users/john/posts');

      // Click on a post link
      await page.getByTestId('post-link-first').click();

      // Should navigate to post detail with both params preserved
      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();
      await expect(page.getByTestId('detail-user-id')).toHaveText('john');
      await expect(page.getByTestId('detail-post-id')).toHaveText('first-post');
      await expect(page).toHaveURL(/\/es\/users\/john\/posts\/first-post$/);
    });
  });

  // ============================================
  // SECTION 3: Param Values That Match Segment Names
  // ============================================
  test.describe('Param Value Matches Segment Name (should NOT translate)', () => {
    test('userId "about" is preserved in English', async ({ page }) => {
      await page.goto('/users/about');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('about');
      await expect(page).toHaveURL('/users/about');
    });

    test('userId "about" is preserved in Spanish', async ({ page }) => {
      await page.goto('/es/users/about');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('about');
      await expect(page).toHaveURL('/es/users/about');
    });

    test('userId "blog" is preserved in Spanish', async ({ page }) => {
      await page.goto('/es/users/blog');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('blog');
      await expect(page).toHaveURL('/es/users/blog');
    });

    test('both params preserved in multi-param route', async ({ page }) => {
      await page.goto('/es/users/blog/posts/about');

      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();
      await expect(page.getByTestId('detail-user-id')).toHaveText('blog');
      await expect(page.getByTestId('detail-post-id')).toHaveText('about');
      await expect(page).toHaveURL('/es/users/blog/posts/about');
    });
  });

  // ============================================
  // SECTION 4: Dynamic Segment in Middle of Path
  // ============================================
  test.describe('Dynamic Segment in Middle of Path', () => {
    test('dynamic middle segment works in English', async ({ page }) => {
      await page.goto('/users/john/posts');

      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page.getByTestId('user-posts-user-id')).toHaveText('john');
    });

    test('dynamic middle segment works in Spanish (paths unchanged)', async ({
      page,
    }) => {
      await page.goto('/es/users/john/posts');

      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page.getByTestId('user-posts-user-id')).toHaveText('john');
      await expect(page.getByTestId('user-posts-title')).toContainText(
        'Publicaciones',
      );
    });

    test('browser history works with middle dynamic segment', async ({
      page,
    }) => {
      await page.goto('/es/users/john/posts');

      // Navigate to a post
      await page.getByTestId('post-link-first').click();
      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();

      // Go back
      await page.goBack();
      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page).toHaveURL(/\/es\/users\/john\/posts$/);
    });
  });

  // ============================================
  // SECTION 5: Consecutive Dynamic Segments
  // ============================================
  test.describe('Consecutive Dynamic Segments', () => {
    test('two consecutive params work in English', async ({ page }) => {
      await page.goto('/shop/electronics/laptop-123');

      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-category')).toHaveText(
        'electronics',
      );
      await expect(page.getByTestId('product-id')).toHaveText('laptop-123');
    });

    test('two consecutive params work in Spanish (paths unchanged)', async ({
      page,
    }) => {
      // /shop stays as /shop (no translation to /tienda)
      await page.goto('/es/shop/electronics/laptop-123');

      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-category')).toHaveText(
        'electronics',
      );
      await expect(page.getByTestId('product-id')).toHaveText('laptop-123');
    });

    test('params that match segment names are preserved', async ({ page }) => {
      // category = "about", productId = "contact"
      await page.goto('/es/shop/about/contact');

      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-category')).toHaveText('about');
      await expect(page.getByTestId('product-id')).toHaveText('contact');
      await expect(page).toHaveURL('/es/shop/about/contact');
    });
  });

  // ============================================
  // SECTION 6: Edge Cases
  // ============================================
  test.describe('Edge Cases', () => {
    test('URL with query params works with complex routes', async ({
      page,
    }) => {
      await page.goto('/es/users/john/posts?sort=date&order=desc#comments');

      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page.getByTestId('user-posts-user-id')).toHaveText('john');
    });

    test('trailing slash handling with complex routes', async ({ page }) => {
      await page.goto('/es/users/john/posts/');

      // Should either work or redirect to non-trailing version
      await expect(page.getByTestId('user-posts-page')).toBeVisible();
    });

    test('very long param values are preserved', async ({ page }) => {
      const longUserId =
        'this-is-a-very-long-user-id-that-should-still-work-correctly';
      await page.goto(`/es/users/${longUserId}`);

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText(longUserId);
    });

    test('special characters in param values are handled', async ({ page }) => {
      await page.goto('/es/users/user%40email.com');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('user@email.com');
    });

    test('locale switching preserves complex route structure', async ({
      page,
    }) => {
      // Start in Spanish
      await page.goto('/es/users/john/posts');
      await expect(page.getByTestId('user-posts-page')).toBeVisible();

      // Switch to English
      await page.getByTestId('locale-en').click();

      // Should be at /users/john/posts (same path, no prefix)
      await expect(page).toHaveURL('/users/john/posts');
      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page.getByTestId('user-posts-user-id')).toHaveText('john');
    });

    test('locale switching preserves param values', async ({ page }) => {
      // Start in Spanish with userId="about"
      await page.goto('/es/users/about');
      await expect(page.getByTestId('user-id')).toHaveText('about');

      // Switch to English
      await page.getByTestId('locale-en').click();

      // Should be at /users/about
      await expect(page).toHaveURL('/users/about');
      await expect(page.getByTestId('user-id')).toHaveText('about');
    });
  });

  // ============================================
  // SECTION 7: Stress Test Page Link Verification
  // ============================================
  test.describe('Stress Test Page Link Verification', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/stress-test');
    });

    test('static segment links have correct href in English', async ({
      page,
    }) => {
      await expect(page.getByTestId('link-products-featured')).toHaveAttribute(
        'href',
        '/products/featured',
      );
      await expect(page.getByTestId('link-docs-reference')).toHaveAttribute(
        'href',
        '/docs/api/v2/reference',
      );
    });

    test('static segment links have prefix but same path in Spanish', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Paths stay the same, only prefix changes
      await expect(page.getByTestId('link-products-featured')).toHaveAttribute(
        'href',
        '/es/products/featured',
      );
      await expect(page.getByTestId('link-docs-reference')).toHaveAttribute(
        'href',
        '/es/docs/api/v2/reference',
      );
    });

    test('dynamic param links preserve param values in Spanish', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Param = "about" should stay "about"
      await expect(page.getByTestId('link-user-about')).toHaveAttribute(
        'href',
        '/es/users/about',
      );

      // Param = "blog" should stay "blog"
      await expect(page.getByTestId('link-user-blog')).toHaveAttribute(
        'href',
        '/es/users/blog',
      );

      // Multi-param with tricky values
      await expect(page.getByTestId('link-user-post-tricky')).toHaveAttribute(
        'href',
        '/es/users/about/posts/blog',
      );
    });

    test('consecutive dynamic params links work correctly', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Shop link with tricky params - path not translated
      await expect(page.getByTestId('link-shop-tricky')).toHaveAttribute(
        'href',
        '/es/shop/about/contact',
      );
    });
  });
});
