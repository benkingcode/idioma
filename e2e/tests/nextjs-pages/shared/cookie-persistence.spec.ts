import { expect, test } from '@playwright/test';

test.describe('Cookie Persistence', () => {
  test.describe('Cookie Behavior', () => {
    test('locale preference persists across page reloads', async ({ page }) => {
      // Start at home, switch to Spanish
      await page.goto('/');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Reload the page
      await page.reload();

      // Should still be in Spanish
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('locale preference persists when navigating to root', async ({
      page,
    }) => {
      // Start and switch to Spanish
      await page.goto('/');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Navigate to a different page
      await page.getByTestId('nav-about').click();
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });

      // Navigate back to root without locale prefix
      await page.goto('/');

      // Should redirect to Spanish based on cookie
      await expect(page).toHaveURL(/\/es/);
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('clearing cookie resets to Accept-Language detection', async ({
      page,
    }) => {
      // Set Spanish cookie
      await page.context().addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Verify Spanish is active
      await page.goto('/');
      await expect(page).toHaveURL(/\/es/);

      // Clear the cookie
      await page.context().clearCookies();

      // Set Accept-Language to English
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });

      // Navigate to root
      await page.goto('/');

      // Should now use Accept-Language (English)
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });
  });

  test.describe('Cookie Properties', () => {
    test('cookie is set with correct name', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      const cookies = await page.context().cookies();
      const localeCookie = cookies.find((c) => c.name === 'IDIOMI_LOCALE');

      expect(localeCookie).toBeDefined();
      expect(localeCookie?.value).toBe('es');
    });

    test('cookie value updates when switching locales', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });

      // Switch to Spanish
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });

      let cookies = await page.context().cookies();
      let localeCookie = cookies.find((c) => c.name === 'IDIOMI_LOCALE');
      expect(localeCookie?.value).toBe('es');

      // Switch back to English
      await page.getByTestId('locale-en').click();
      await page.waitForURL(/^http:\/\/localhost:\d+\/$/);

      cookies = await page.context().cookies();
      localeCookie = cookies.find((c) => c.name === 'IDIOMI_LOCALE');
      expect(localeCookie?.value).toBe('en');
    });
  });

  test.describe('Cross-Route Persistence', () => {
    test('cookie applies to all routes', async ({ page }) => {
      // Set Spanish cookie manually
      await page.context().addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Visit various routes without locale prefix - should redirect to Spanish
      await page.goto('/about');
      await expect(page).toHaveURL(/\/es\/sobre/);

      await page.goto('/contact');
      await expect(page).toHaveURL(/\/es\/contacto/);

      await page.goto('/blog');
      await expect(page).toHaveURL(/\/es\/articulos/);
    });

    test('explicit URL locale overrides cookie for that request', async ({
      page,
    }) => {
      // Set Spanish cookie
      await page.context().addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Explicitly visit English about page
      await page.goto('/about');

      // Should NOT redirect because the about page (canonical) implies English
      // The URL takes precedence over cookie
      await expect(page.getByTestId('about-title')).toContainText('About');
    });
  });
});
