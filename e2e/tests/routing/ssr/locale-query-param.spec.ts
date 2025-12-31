import { expect, test } from '@playwright/test';

// Translations in the fixture:
// English: "About our company"
// Spanish: "Acerca de nuestra empresa"

test.describe('_idiomi Query Param Detection (SSR)', () => {
  test('server uses _idiomi query param when present', async ({ page }) => {
    // Navigate with _idiomi query param (simulating edge middleware)
    await page.goto('/about?_idiomi=es');

    // Should use Spanish from query param (redirects to /es/sobre with localized path)
    await expect(page).toHaveURL(/\/es/);
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('_idiomi query param takes precedence over Accept-Language', async ({
    page,
  }) => {
    // Set Accept-Language to English
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    });

    // Navigate with Spanish _idiomi query param
    await page.goto('/about?_idiomi=es');

    // Should use Spanish from query param, not English from header
    await expect(page).toHaveURL(/\/es/);
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('_idiomi query param takes precedence over cookie', async ({
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

    // Navigate with Spanish _idiomi query param
    await page.goto('/about?_idiomi=es');

    // Should use Spanish from query param, not English from cookie
    await expect(page).toHaveURL(/\/es/);
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('URL path locale takes precedence over _idiomi query param', async ({
    page,
  }) => {
    // Navigate with Spanish in URL path but English in query param
    await page.goto('/es/about?_idiomi=en');

    // Path locale (es) should take precedence over query param (en)
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('ignores invalid _idiomi values and falls back to cookie', async ({
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

    // Navigate with invalid _idiomi query param
    await page.goto('/about?_idiomi=invalid');

    // Should fall back to cookie (Spanish)
    await expect(page).toHaveURL(/\/es/);
  });

  test('falls back to Accept-Language when _idiomi is missing', async ({
    page,
  }) => {
    // Set Accept-Language to Spanish
    await page.route('**/*', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });
    });

    // Navigate without _idiomi query param
    await page.goto('/about');

    // Should use Accept-Language header
    await expect(page).toHaveURL(/\/es/);
  });

  test('cookie is synced from _idiomi detection', async ({ page, context }) => {
    // Navigate with _idiomi query param
    await page.goto('/about?_idiomi=es');

    // Check that cookie was set
    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === 'IDIOMI_LOCALE');
    expect(localeCookie?.value).toBe('es');
  });
});
