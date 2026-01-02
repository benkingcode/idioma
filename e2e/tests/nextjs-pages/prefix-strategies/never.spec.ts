import { expect, test } from '@playwright/test';

/**
 * Tests specific to the 'never' prefix strategy.
 *
 * never behavior:
 * - NO locale prefix in URL for any locale
 * - Same URL serves different languages based on cookie/header
 * - /es/ should redirect to / (strip any locale prefix)
 * - Best for CDN caching with edge locale detection
 */
test.describe('Prefix Strategy: never', () => {
  test.describe('No Locale Prefix', () => {
    test('home page has no locale prefix', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('home-title')).toBeVisible();
      // URL should never have locale prefix
      expect(page.url()).not.toMatch(/\/(en|es)\//);
      expect(page.url()).not.toMatch(/\/(en|es)$/);
    });

    test('about page has no locale prefix', async ({ page }) => {
      await page.goto('/about');
      await expect(page.getByTestId('about-title')).toBeVisible();
      expect(page.url()).not.toMatch(/\/(en|es)\//);
    });

    test('strips locale prefix if provided', async ({ page }) => {
      // Visit /es/ - should redirect to / and use cookie/header for locale
      await page.goto('/es');
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    });

    test('strips locale prefix from subpages', async ({ page }) => {
      await page.goto('/es/about');
      await expect(page).toHaveURL(/\/about$/);
      expect(page.url()).not.toMatch(/\/es\//);
    });
  });

  test.describe('Locale Detection Without Prefix', () => {
    test('Accept-Language determines content language', async ({ page }) => {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'es-ES,es;q=0.9',
      });

      await page.goto('/');

      // URL has no prefix
      expect(page.url()).not.toMatch(/\/es/);
      // But content is in Spanish
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('cookie determines content language', async ({ page }) => {
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/');

      // URL has no prefix
      expect(page.url()).not.toMatch(/\/es/);
      // But content is in Spanish
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('cookie takes precedence over Accept-Language', async ({ page }) => {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'es-ES,es;q=0.9',
      });
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
          value: 'en',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/');

      // Content should be English (cookie preference)
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });
  });

  test.describe('Locale Switching', () => {
    test('switching locale does not change URL', async ({ page }) => {
      await page.goto('/');
      const initialUrl = page.url();

      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-es').click();

      // Wait for content to change
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );

      // URL should remain the same (no prefix added)
      expect(page.url()).toBe(initialUrl);
    });

    test('locale switch sets cookie for future requests', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-es').click();

      // Check cookie was set
      const cookies = await page.context().cookies();
      const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
      expect(localeCookie?.value).toBe('es');
    });
  });

  test.describe('Link Href Generation', () => {
    test('links have no locale prefix', async ({ page }) => {
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/');

      const homeLink = page.getByTestId('nav-home');
      const aboutLink = page.getByTestId('nav-about');

      // Links should NOT have locale prefix
      expect(await homeLink.getAttribute('href')).toBe('/');
      const aboutHref = await aboutLink.getAttribute('href');
      expect(aboutHref).not.toMatch(/^\/es\//);
    });
  });

  test.describe('Same URL Different Content', () => {
    test('same URL serves English or Spanish based on preference', async ({
      page,
      context,
    }) => {
      // First visit with English preference
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US',
      });
      await page.goto('/about');
      await expect(page.getByTestId('about-title')).toContainText('About');

      // Same URL with Spanish cookie
      await context.addCookies([
        {
          name: 'NEXT_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);
      await page.reload();

      // Same URL, different content
      await expect(page.getByTestId('about-title')).toContainText(
        'Acerca de nuestra empresa',
      );
    });
  });
});
