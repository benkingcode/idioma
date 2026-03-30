import { expect, test } from '@playwright/test';

test.describe('Accept-Language Header Detection (SSR)', () => {
  test('server detects locale from Accept-Language header', async ({
    page,
  }) => {
    // Intercept requests to set Accept-Language header
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });
    });

    // Navigate to root - server should detect Spanish
    await page.goto('/');

    // Should redirect to Spanish URL
    await expect(page).toHaveURL(/\/es/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });

  test('cookie takes precedence over Accept-Language', async ({
    page,
    context,
  }) => {
    // Set English locale cookie
    await context.addCookies([
      {
        name: 'IDIOMI_LOCALE',
        value: 'en',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Intercept requests to set Spanish Accept-Language header
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });
    });

    // Navigate to root
    await page.goto('/');

    // Should stay in English (cookie takes precedence over Accept-Language)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Welcome to our website',
    );
  });

  test('URL locale takes precedence over Accept-Language', async ({ page }) => {
    // Intercept requests to set English Accept-Language header
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    });

    // Navigate directly to Spanish URL
    await page.goto('/es');

    // Should use URL locale, not Accept-Language
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });

  test('language distance matching (en-GB matches en)', async ({ page }) => {
    // Intercept requests to set British English header
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'en-GB,en;q=0.9',
        },
      });
    });

    // Navigate to root
    await page.goto('/');

    // Should match English (language distance algorithm)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Welcome to our website',
    );
  });

  test('language distance matching (es-MX matches es)', async ({ page }) => {
    // Intercept requests to set Mexican Spanish header
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'es-MX,es;q=0.9',
        },
      });
    });

    // Navigate to root
    await page.goto('/');

    // Should match Spanish (language distance algorithm)
    await expect(page).toHaveURL(/\/es/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });

  test('falls back to default when Accept-Language unsupported', async ({
    page,
  }) => {
    // Intercept requests to set unsupported language header
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'fr-FR,fr;q=0.9,de;q=0.8',
        },
      });
    });

    // Navigate to root
    await page.goto('/');

    // Should fall back to English (default locale)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Welcome to our website',
    );
  });

  test('respects quality values in Accept-Language', async ({ page }) => {
    // Intercept requests with mixed quality values (prefer Spanish)
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          // French first but unsupported, Spanish preferred over English
          'Accept-Language': 'fr;q=1.0,es;q=0.9,en;q=0.8',
        },
      });
    });

    // Navigate to root
    await page.goto('/');

    // Should choose Spanish (highest quality among supported locales)
    await expect(page).toHaveURL(/\/es/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });

  test('handles wildcard Accept-Language', async ({ page }) => {
    // Intercept requests with wildcard
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': '*',
        },
      });
    });

    // Navigate to root
    await page.goto('/');

    // Should use default locale for wildcard
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Welcome to our website',
    );
  });
});
