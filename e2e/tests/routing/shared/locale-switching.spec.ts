import { expect, test } from '@playwright/test';

test.describe('Locale Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('switches from English to Spanish', async ({ page }) => {
    // Start in English
    await expect(page.getByTestId('home-title')).toContainText(
      'Welcome to our website',
    );

    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Content should be in Spanish
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });

  test('switches from Spanish to English', async ({ page }) => {
    // Start in Spanish
    await page.goto('/es');
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );

    // Switch to English
    await page.getByTestId('locale-en').click();
    await page.waitForURL(/^http:\/\/localhost:\d+\/$/);

    // Content should be in English
    await expect(page.getByTestId('home-title')).toContainText(
      'Welcome to our website',
    );
  });

  test('preserves route on locale switch', async ({ page }) => {
    // Navigate to About page
    await page.getByTestId('nav-about').click();
    await page.waitForURL(/\/about/);

    // Verify we're on About
    await expect(page.getByTestId('about-page')).toBeVisible();

    // Switch to Spanish
    await page.getByTestId('locale-es').click();

    // Should still be on About page (in Spanish)
    await expect(page.getByTestId('about-page')).toBeVisible();
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('sets locale cookie on switch', async ({ page, context }) => {
    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Check that cookie was set
    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === 'IDIOMA_LOCALE');
    expect(localeCookie).toBeDefined();
    expect(localeCookie?.value).toBe('es');
  });

  test('locale button shows active state', async ({ page }) => {
    // English button should be active initially
    const enButton = page.getByTestId('locale-en');
    await expect(enButton).toHaveCSS('font-weight', '700'); // bold

    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Spanish button should now be active
    const esButton = page.getByTestId('locale-es');
    await expect(esButton).toHaveCSS('font-weight', '700'); // bold
  });

  test('rapid locale switching works correctly', async ({ page }) => {
    // Switch back and forth rapidly
    await page.getByTestId('locale-es').click();
    await page.getByTestId('locale-en').click();
    await page.getByTestId('locale-es').click();

    // Should end up in Spanish
    await page.waitForURL(/\/es/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });
});
