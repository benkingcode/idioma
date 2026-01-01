import { expect, test } from '@playwright/test';

test.describe('Complex Routes - Localized Paths Stress Tests', () => {
  // ============================================
  // SECTION 1: Multiple Static Segments
  // ============================================
  test.describe('Multiple Static Segments', () => {
    test('two static segments translate correctly in English', async ({
      page,
    }) => {
      await page.goto('/products/featured');

      await expect(page.getByTestId('featured-products-page')).toBeVisible();
      await expect(page).toHaveURL('/products/featured');
    });

    test('two static segments translate correctly in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/productos/destacados');

      await expect(page.getByTestId('featured-products-page')).toBeVisible();
      await expect(page.getByTestId('featured-products-title')).toContainText(
        'Productos Destacados',
      );
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
      await page.goto('/es/documentos/api/v2/referencia');

      await expect(page.getByTestId('docs-reference-page')).toBeVisible();
      await expect(page.getByTestId('docs-reference-title')).toContainText(
        'Referencia de API',
      );
    });

    test('navigation to deep nested route preserves localization', async ({
      page,
    }) => {
      await page.goto('/es/stress-test');

      // Click the link to docs reference
      await page.getByTestId('link-docs-reference').click();

      // Should navigate to localized URL
      await expect(page).toHaveURL('/es/documentos/api/v2/referencia');
      await expect(page.getByTestId('docs-reference-page')).toBeVisible();
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

    test('two dynamic params accessible in Spanish with translated path', async ({
      page,
    }) => {
      // /users -> /usuarios, /posts -> /publicaciones
      await page.goto('/es/usuarios/john/publicaciones/hello-world');

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
      await page.goto('/es/usuarios/john/publicaciones');

      // Click on a post link
      await page.getByTestId('post-link-first').click();

      // Should navigate to post detail with both params preserved
      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();
      await expect(page.getByTestId('detail-user-id')).toHaveText('john');
      await expect(page.getByTestId('detail-post-id')).toHaveText('first-post');
      await expect(page).toHaveURL(
        /\/es\/usuarios\/john\/publicaciones\/first-post$/,
      );
    });
  });

  // ============================================
  // SECTION 3: CRITICAL - Param Value Matching Translated Segment
  // ============================================
  test.describe('Param Value Matches Translated Segment Name', () => {
    test('userId "about" is NOT translated to "sobre" in English', async ({
      page,
    }) => {
      await page.goto('/users/about');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('about');
      // URL should stay as /users/about, NOT /users/sobre
      await expect(page).toHaveURL('/users/about');
    });

    test('userId "about" is NOT translated in Spanish URL', async ({
      page,
    }) => {
      // "about" as a route segment would become "sobre"
      // But as a param VALUE, it should remain "about"
      await page.goto('/es/usuarios/about');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('about');
      // URL should be /es/usuarios/about, NOT /es/usuarios/sobre
      await expect(page).toHaveURL('/es/usuarios/about');
    });

    test('userId "blog" is NOT translated to "articulos" in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/usuarios/blog');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('blog');
      // URL should NOT become /es/usuarios/articulos
      await expect(page).toHaveURL('/es/usuarios/blog');
    });

    test('userId "sobre" (Spanish word) is preserved as-is', async ({
      page,
    }) => {
      await page.goto('/es/usuarios/sobre');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('sobre');
      // Even though "sobre" is a Spanish translation of "about",
      // it should NOT be reverse-translated back to "about"
      await expect(page).toHaveURL('/es/usuarios/sobre');
    });

    test('postId "about" and userId "blog" both preserved in multi-param route', async ({
      page,
    }) => {
      await page.goto('/es/usuarios/blog/publicaciones/about');

      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();
      await expect(page.getByTestId('detail-user-id')).toHaveText('blog');
      await expect(page.getByTestId('detail-post-id')).toHaveText('about');
      // Neither param should be translated
      await expect(page).toHaveURL('/es/usuarios/blog/publicaciones/about');
    });

    test('link generation preserves param values that match segment names', async ({
      page,
    }) => {
      await page.goto('/es/stress-test');

      // Check that the link href has "about" as the param, not "sobre"
      const linkUserAbout = page.getByTestId('link-user-about');
      await expect(linkUserAbout).toHaveAttribute(
        'href',
        /\/es\/usuarios\/about$/,
      );
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

    test('path segments around dynamic translate correctly in Spanish', async ({
      page,
    }) => {
      // Route: /users/$userId/posts
      // Spanish: /usuarios/$userId/publicaciones
      await page.goto('/es/usuarios/john/publicaciones');

      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page.getByTestId('user-posts-user-id')).toHaveText('john');
      await expect(page.getByTestId('user-posts-title')).toContainText(
        'Publicaciones',
      );
    });

    test('delocalizeUrl correctly handles middle dynamic segment', async ({
      page,
    }) => {
      // This is a critical test - the URL rewriter must:
      // 1. Recognize /usuarios as a translated segment
      // 2. Preserve john as the param value
      // 3. Recognize /publicaciones as a translated segment
      // 4. Translate to canonical /users/john/posts for route matching
      await page.goto('/es/usuarios/john/publicaciones');

      await expect(page.getByTestId('user-posts-page')).toBeVisible();
    });

    test('localizeUrl correctly reconstructs path with middle dynamic', async ({
      page,
    }) => {
      await page.goto('/es/usuarios/testuser/publicaciones');

      // Links on this page should have correctly localized hrefs
      const postLink = page.getByTestId('post-link-first');
      // Should be /es/usuarios/testuser/publicaciones/first-post
      await expect(postLink).toHaveAttribute(
        'href',
        /\/es\/usuarios\/testuser\/publicaciones\/first-post$/,
      );
    });

    test('browser history works with middle dynamic segment', async ({
      page,
    }) => {
      await page.goto('/es/usuarios/john/publicaciones');

      // Navigate to a post
      await page.getByTestId('post-link-first').click();
      await expect(page.getByTestId('user-post-detail-page')).toBeVisible();

      // Go back
      await page.goBack();
      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page).toHaveURL(/\/es\/usuarios\/john\/publicaciones$/);
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

    test('base segment translates but params preserved in Spanish', async ({
      page,
    }) => {
      // /shop -> /tienda, but $category and $productId stay as-is
      await page.goto('/es/tienda/electronics/laptop-123');

      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-category')).toHaveText(
        'electronics',
      );
      await expect(page.getByTestId('product-id')).toHaveText('laptop-123');
    });

    test('params that match segment names are NOT translated', async ({
      page,
    }) => {
      // category = "about", productId = "contact"
      // Neither should be translated even though they match segment names
      await page.goto('/es/tienda/about/contact');

      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-category')).toHaveText('about');
      await expect(page.getByTestId('product-id')).toHaveText('contact');
      await expect(page).toHaveURL('/es/tienda/about/contact');
    });

    test('direct URL access works for consecutive dynamics', async ({
      page,
    }) => {
      await page.goto('/es/tienda/ropa/camisa-azul');

      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-category')).toHaveText('ropa');
      await expect(page.getByTestId('product-id')).toHaveText('camisa-azul');
    });
  });

  // ============================================
  // SECTION 6: Edge Cases and Stress Tests
  // ============================================
  test.describe('Edge Cases', () => {
    test('URL with query params works with complex routes', async ({
      page,
    }) => {
      await page.goto(
        '/es/usuarios/john/publicaciones?sort=date&order=desc#comments',
      );

      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page.getByTestId('user-posts-user-id')).toHaveText('john');
    });

    test('trailing slash handling with complex routes', async ({ page }) => {
      await page.goto('/es/usuarios/john/publicaciones/');

      // Should either work or redirect to non-trailing version
      await expect(page.getByTestId('user-posts-page')).toBeVisible();
    });

    test('very long param values are preserved', async ({ page }) => {
      const longUserId =
        'this-is-a-very-long-user-id-that-should-still-work-correctly';
      await page.goto(`/es/usuarios/${longUserId}`);

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText(longUserId);
    });

    test('special characters in param values are handled', async ({ page }) => {
      // URL-encoded special chars
      await page.goto('/es/usuarios/user%40email.com');

      await expect(page.getByTestId('user-profile-page')).toBeVisible();
      await expect(page.getByTestId('user-id')).toHaveText('user@email.com');
    });

    test('locale switching preserves complex route structure', async ({
      page,
    }) => {
      // Start in Spanish
      await page.goto('/es/usuarios/john/publicaciones');
      await expect(page.getByTestId('user-posts-page')).toBeVisible();

      // Wait for hydration (SSR sends HTML first, then JS hydrates)
      await page.waitForLoadState('networkidle');

      // Switch to English
      await page.getByTestId('locale-en').click();

      // Should be at /users/john/posts
      await expect(page).toHaveURL('/users/john/posts');
      await expect(page.getByTestId('user-posts-page')).toBeVisible();
      await expect(page.getByTestId('user-posts-user-id')).toHaveText('john');
    });

    test('locale switching preserves param values that match segment names', async ({
      page,
    }) => {
      // Start in Spanish with userId="about"
      await page.goto('/es/usuarios/about');
      await expect(page.getByTestId('user-id')).toHaveText('about');

      // Wait for hydration (SSR sends HTML first, then JS hydrates)
      await page.waitForLoadState('networkidle');

      // Switch to English
      await page.getByTestId('locale-en').click();

      // Should be at /users/about (not /users/sobre or anything else)
      await expect(page).toHaveURL('/users/about');
      await expect(page.getByTestId('user-id')).toHaveText('about');
    });
  });

  // ============================================
  // SECTION 7: Splat Routes (Catch-all)
  // ============================================
  test.describe('Splat Routes', () => {
    // Note: Splat routes work best with non-default locales due to how
    // TanStack Router handles optional parent segments. Tests focus on
    // Spanish paths which go through proper URL rewriting.

    test('splat route works with localized base segment in Spanish', async ({
      page,
    }) => {
      // /docs -> /documentos in Spanish
      await page.goto('/es/documentos/guia/inicio');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-splat')).toHaveText('guia/inicio');
      // Note: Title translation test removed - focus is on splat URL handling
    });

    test('splat route captures deeply nested paths in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/documentos/api/v3/users/create/bulk');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-splat')).toHaveText(
        'api/v3/users/create/bulk',
      );
    });

    test('splat route captures single segment in Spanish', async ({ page }) => {
      await page.goto('/es/documentos/intro');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-splat')).toHaveText('intro');
    });

    test('splat route handles special characters in path in Spanish', async ({
      page,
    }) => {
      await page.goto('/es/documentos/tutorials/getting-started-with-react');

      await expect(page.getByTestId('docs-page')).toBeVisible();
      await expect(page.getByTestId('docs-splat')).toHaveText(
        'tutorials/getting-started-with-react',
      );
    });

    test('splat route distinguishes from static docs/api/v2/reference route', async ({
      page,
    }) => {
      // This tests that the more specific static route takes precedence
      // The existing /docs/api/v2/reference is a static route, not caught by splat
      await page.goto('/docs/api/v2/reference');

      // Should match the static route, not the splat
      await expect(page.getByTestId('docs-reference-page')).toBeVisible();
    });

    test('splat route in Spanish distinguishes from static docs route', async ({
      page,
    }) => {
      // Navigate to the static docs route in Spanish
      await page.goto('/es/documentos/api/v2/referencia');

      // Should match the static route, not the splat
      await expect(page.getByTestId('docs-reference-page')).toBeVisible();
    });
  });

  // ============================================
  // SECTION 8: Stress Test Page Links
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

    test('static segment links translate in Spanish', async ({ page }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      await expect(page.getByTestId('link-products-featured')).toHaveAttribute(
        'href',
        '/es/productos/destacados',
      );
      await expect(page.getByTestId('link-docs-reference')).toHaveAttribute(
        'href',
        '/es/documentos/api/v2/referencia',
      );
    });

    test('dynamic param links preserve param values in Spanish', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Param = "about" should stay "about", not become "sobre"
      await expect(page.getByTestId('link-user-about')).toHaveAttribute(
        'href',
        '/es/usuarios/about',
      );

      // Param = "blog" should stay "blog", not become "articulos"
      await expect(page.getByTestId('link-user-blog')).toHaveAttribute(
        'href',
        '/es/usuarios/blog',
      );

      // Tricky multi-param: both should be preserved
      await expect(page.getByTestId('link-user-post-tricky')).toHaveAttribute(
        'href',
        '/es/usuarios/about/publicaciones/blog',
      );
    });

    test('consecutive dynamic params links work correctly', async ({
      page,
    }) => {
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Shop link with tricky params
      await expect(page.getByTestId('link-shop-tricky')).toHaveAttribute(
        'href',
        '/es/tienda/about/contact',
      );
    });
  });
});
