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

    // Wait for hydration (SSR sends HTML first, then JS hydrates)
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-hydrated="true"]', { state: 'attached' });

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

    // Wait for hydration before clicking locale switch
    await page.waitForSelector('[data-hydrated="true"]', { state: 'attached' });

    // Switch to Spanish
    await page.getByTestId('locale-es').click();

    // Should still be on About page (in Spanish, with localized path)
    await expect(page.getByTestId('about-page')).toBeVisible();
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('sets locale cookie on switch', async ({ page }) => {
    // Wait for hydration so onClick handler is attached
    await page.waitForSelector('[data-hydrated="true"]', { state: 'attached' });

    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Check that cookie was set
    const cookies = await page.evaluate(() => document.cookie);
    expect(cookies).toContain('NEXT_LOCALE=es');
  });

  test('locale button shows active state', async ({ page }) => {
    // Wait for hydration
    await page.waitForSelector('[data-hydrated="true"]', { state: 'attached' });

    // English button should be active initially (via aria-pressed)
    const enButton = page.getByTestId('locale-en');
    await expect(enButton).toHaveAttribute('aria-pressed', 'true');

    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Spanish button should now be active (via aria-pressed)
    const esButton = page.getByTestId('locale-es');
    await expect(esButton).toHaveAttribute('aria-pressed', 'true');
    // English button should no longer be active
    await expect(enButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('rapid locale switching works correctly', async ({ page }) => {
    // Wait for hydration
    await page.waitForSelector('[data-hydrated="true"]', { state: 'attached' });

    // Switch back and forth rapidly
    await page.getByTestId('locale-es').click();
    await page.waitForSelector('[data-hydrated="true"]', { state: 'attached' });
    await page.getByTestId('locale-en').click();
    await page.waitForSelector('[data-hydrated="true"]', { state: 'attached' });
    await page.getByTestId('locale-es').click();

    // Should end up in Spanish
    await page.waitForURL(/\/es/);
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });
});
