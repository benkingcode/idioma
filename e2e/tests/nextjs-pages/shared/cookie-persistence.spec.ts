import { expect, test } from '@playwright/test';
import { setAcceptLanguage } from '../../helpers/accept-language';

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
          name: 'NEXT_LOCALE',
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
      await setAcceptLanguage(page, 'en-US,en;q=0.9');

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
      const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');

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
      let localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
      expect(localeCookie?.value).toBe('es');

      // Switch back to English
      await page.getByTestId('locale-en').click();
      await page.waitForURL(/^http:\/\/localhost:\d+\/$/);

      cookies = await page.context().cookies();
      localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
      expect(localeCookie?.value).toBe('en');
    });
  });

  test.describe('Cross-Route Persistence', () => {
    // Note: Pages Router with built-in i18n only uses NEXT_LOCALE cookie for
    // initial "/" detection. Explicit URLs like "/about" are NOT redirected
    // based on cookie - they serve the default locale. This test is for
    // fixtures with custom middleware that redirects based on cookie.
    test('cookie applies to all routes', async ({ page }, testInfo) => {
      // Skip for Pages Router - it uses built-in i18n which doesn't redirect
      // explicit URLs based on cookie
      test.skip(
        testInfo.project.name.includes('nextjs-pages'),
        'Pages Router built-in i18n does not redirect explicit paths based on cookie',
      );

      const isLocalized =
        testInfo.project.name.includes('localized-') &&
        !testInfo.project.name.includes('non-localized');

      // Set Spanish cookie manually
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Visit various routes without locale prefix - should redirect to Spanish
      await page.goto('/about');
      if (isLocalized) {
        await expect(page).toHaveURL(/\/es\/sobre/);
      } else {
        await expect(page).toHaveURL(/\/es\/about/);
      }

      await page.goto('/contact');
      if (isLocalized) {
        await expect(page).toHaveURL(/\/es\/contacto/);
      } else {
        await expect(page).toHaveURL(/\/es\/contact/);
      }

      await page.goto('/blog');
      if (isLocalized) {
        await expect(page).toHaveURL(/\/es\/articulos/);
      } else {
        await expect(page).toHaveURL(/\/es\/blog/);
      }
    });

    test('explicit URL locale overrides cookie for that request', async ({
      page,
    }) => {
      // Set Spanish cookie
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
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
