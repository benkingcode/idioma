import { expect, test } from '@playwright/test';

test.describe('Mixed Routes (Localized + Non-Localized)', () => {
  test.describe('Non-Localized Routes', () => {
    test('/dashboard does NOT redirect to /es/dashboard', async ({ page }) => {
      // Use page.route() to intercept and set Accept-Language header (works with SSR)
      await page.route('**/*', (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            'Accept-Language': 'es-ES,es;q=0.9',
          },
        });
      });

      const response = await page.goto('/dashboard');

      // Should return 200, not redirect
      expect(response?.status()).toBe(200);
      // URL should stay at /dashboard
      expect(page.url()).toContain('/dashboard');
      expect(page.url()).not.toContain('/es/dashboard');
    });

    test('/dashboard with Spanish cookie renders Spanish translations', async ({
      page,
      context,
    }) => {
      // Set Spanish locale cookie
      await context.addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/dashboard');

      // URL should stay at /dashboard (no redirect)
      expect(page.url()).toContain('/dashboard');
      expect(page.url()).not.toContain('/es/');

      // Content should show Spanish locale is detected
      await expect(page.getByTestId('dashboard-locale')).toContainText('es');
    });

    test('/dashboard without cookie uses Accept-Language detection', async ({
      page,
    }) => {
      // Use page.route() to intercept and set Accept-Language header (works with SSR)
      await page.route('**/*', (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            'Accept-Language': 'es-ES,es;q=0.9',
          },
        });
      });

      await page.goto('/dashboard');

      // URL should stay at /dashboard (no redirect)
      expect(page.url()).toContain('/dashboard');

      // Content should detect Spanish from Accept-Language
      await expect(page.getByTestId('dashboard-locale')).toContainText('es');
    });

    test('/dashboard defaults to English when no preference', async ({
      page,
    }) => {
      // No cookie, default Accept-Language
      await page.goto('/dashboard');

      // URL should stay at /dashboard
      expect(page.url()).toContain('/dashboard');

      // Should default to English
      await expect(page.getByTestId('dashboard-locale')).toContainText('en');
    });
  });

  test.describe('Localized Routes', () => {
    test('/about with Spanish Accept-Language redirects to /es/sobre', async ({
      page,
    }) => {
      // Use page.route() to intercept and set Accept-Language header (works with SSR)
      await page.route('**/*', (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            'Accept-Language': 'es-ES,es;q=0.9',
          },
        });
      });

      await page.goto('/about');

      // Should redirect to Spanish locale prefix with translated path
      expect(page.url()).toContain('/es/');
      // With localizedPaths: true, /about becomes /sobre in Spanish
      expect(page.url()).toMatch(/\/es\/sobre/);
    });

    test('/ (root) with Spanish Accept-Language redirects to /es/', async ({
      page,
    }) => {
      // Use page.route() to intercept and set Accept-Language header (works with SSR)
      await page.route('**/*', (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            'Accept-Language': 'es-ES,es;q=0.9',
          },
        });
      });

      await page.goto('/');

      // Should redirect to Spanish locale prefix
      expect(page.url()).toContain('/es');
    });

    test('/en/about with default locale strips prefix (as-needed strategy)', async ({
      page,
    }) => {
      // Navigate to explicitly prefixed default locale
      await page.goto('/en/about');

      // With as-needed strategy, default locale prefix should be stripped
      expect(page.url()).not.toContain('/en/');
      expect(page.url()).toContain('/about');
    });
  });

  test.describe('Navigation Between Route Types', () => {
    test('can navigate from localized route to non-localized dashboard', async ({
      page,
    }) => {
      // Start on localized Spanish home page
      await page.goto('/es/');
      await expect(page.getByTestId('nav-home')).toBeVisible();

      // Click dashboard link
      await page.getByTestId('nav-dashboard').click();
      await page.waitForURL('**/dashboard');

      // Should be on /dashboard (not /es/dashboard)
      expect(page.url()).toContain('/dashboard');
      expect(page.url()).not.toContain('/es/dashboard');

      // Dashboard should show Spanish locale (from cookie/detection)
      await expect(page.getByTestId('dashboard-title')).toBeVisible();
    });

    test('can navigate from non-localized dashboard to localized route', async ({
      page,
      context,
    }) => {
      // Set Spanish cookie
      await context.addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Start on dashboard
      await page.goto('/dashboard');
      await expect(page.getByTestId('dashboard-title')).toBeVisible();

      // Click home link
      await page.getByTestId('nav-home').click();
      // Wait for navigation to Spanish home page (/es or /es/)
      await page.waitForURL(/\/es\/?$/);

      // Should be on Spanish localized home page
      expect(page.url()).toMatch(/\/es\/?$/);
    });
  });
});
