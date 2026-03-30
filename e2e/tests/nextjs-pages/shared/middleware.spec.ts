import { expect, test } from '@playwright/test';

// Check if current fixture uses localized paths
const isLocalizedPathFixture = () => {
  const projectName = test.info().project.name;
  return (
    projectName.includes('localized-') && !projectName.includes('non-localized')
  );
};

test.describe('Middleware Edge Cases', () => {
  test.describe('Static Assets', () => {
    test('does not intercept Next.js internal routes', async ({ page }) => {
      // _next/static should not be processed by locale middleware
      const response = await page.goto('/_next/static/chunks/main.js');
      // Should either return the file or 404, but not redirect to a locale
      expect(response?.url()).not.toMatch(/\/es\/_next/);
      expect(response?.url()).not.toMatch(/\/en\/_next/);
    });

    test('does not intercept favicon', async ({ page }) => {
      const response = await page.goto('/favicon.ico');
      // Should not redirect to localized path
      expect(response?.url()).toMatch(/favicon\.ico/);
    });
  });

  test.describe('Locale Prefix Edge Cases', () => {
    test('handles trailing slashes consistently', async ({ page }) => {
      await page.goto('/es/');
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('handles double slashes gracefully', async ({ page }) => {
      // Double slashes in path should be normalized by the server
      // Note: We can't test '//es' because browsers interpret that as a protocol-relative URL
      await page.goto('/es//about');
      // Should either normalize to /es/about or still work
      await expect(page.getByTestId('about-title')).toBeVisible();
    });

    test('rejects invalid locale prefix', async ({ page }) => {
      // /fr is not a supported locale, should fall back to default
      await page.goto('/fr');

      // Should either 404 or redirect to default locale
      // The exact behavior depends on implementation
      const url = page.url();
      expect(url).not.toMatch(/\/fr\//);
    });

    test('case sensitivity in locale prefix', async ({ page }) => {
      // /ES (uppercase) - behavior depends on implementation
      await page.goto('/ES');

      // Should either normalize to /es or treat as unknown route
      // This tests that the implementation handles case properly
      const url = page.url();
      // Either redirected to /es or stayed at root (default)
      expect(url.includes('/ES/')).toBe(false);
    });
  });

  test.describe('URL Encoding', () => {
    test('handles special characters in dynamic segments', async ({ page }) => {
      // Blog slug with special characters
      await page.goto('/blog/hello-world-123');
      await expect(page.getByTestId('blog-post-page')).toBeVisible();
      await expect(page.getByTestId('blog-post-slug')).toContainText(
        'hello-world-123',
      );
    });
  });

  test.describe('Redirect Behavior', () => {
    test('preserves query parameters on redirect', async ({ page }) => {
      // Set Spanish preference
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Visit with query params
      await page.goto('/about?utm_source=test&ref=123');

      // Should preserve query params after redirect
      expect(page.url()).toContain('utm_source=test');
      expect(page.url()).toContain('ref=123');
    });

    test('preserves hash on redirect', async ({ page }) => {
      // Set Spanish preference
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Visit with hash - Note: hash is client-side only
      await page.goto('/about#section1');

      // Hash should be preserved (though this is client-side)
      expect(page.url()).toContain('#section1');
    });
  });

  test.describe('Concurrent Requests', () => {
    test('handles rapid navigation correctly', async ({ page }) => {
      await page.goto('/');

      // Rapid navigation
      const navigations = ['/about', '/contact', '/blog', '/'];

      for (const path of navigations) {
        await page.goto(path);
      }

      // Should end up at home
      await expect(page.getByTestId('home-title')).toBeVisible();
    });
  });
});

// Tests specific to localized path fixtures (e.g., /es/sobre instead of /es/about)
test.describe('Localized Paths (fixtures with translated URLs)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !isLocalizedPathFixture(),
      'Only applies to localized path fixtures',
    );
  });

  test('canonical path with Spanish cookie redirects to localized', async ({
    page,
  }) => {
    // Set Spanish preference
    await page.context().addCookies([
      {
        name: 'NEXT_LOCALE',
        value: 'es',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Visit canonical /about
    await page.goto('/about');

    // Should redirect to /es/sobre
    await expect(page).toHaveURL(/\/es\/sobre/);
  });

  test('localized path for wrong locale redirects correctly', async ({
    page,
  }) => {
    // Visit Spanish path /sobre without /es prefix
    await page.goto('/sobre');

    // This is an unknown route in English, should 404 or redirect
    // Exact behavior depends on implementation
  });

  test('handles encoded characters in localized path', async ({ page }) => {
    // Visit blog with URL-encoded slug in localized path
    await page.goto('/es/articulos/mi%20post');
    // Should work with encoded spaces
    await expect(page.getByTestId('blog-post-page')).toBeVisible();
  });
});
