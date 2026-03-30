import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Suspense Mode - Lazy Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders content after initial load', async ({ page }) => {
    // Content should be visible (not showing fallback)
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );
    await expect(page.getByTestId('suspense-fallback')).not.toBeVisible();
  });

  test('loads translations successfully in default locale', async ({
    page,
  }) => {
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );
    await expect(page.getByTestId('basic-welcome')).toContainText(
      'Welcome to our application',
    );
  });

  test('switches to Spanish locale successfully', async ({ page }) => {
    await selectLocale(page, 'es');
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );
  });

  test('switches to Arabic locale successfully', async ({ page }) => {
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'مرحبا، العالم!',
    );
  });

  test('plurals work in Suspense mode', async ({ page }) => {
    // Test that ICU plurals work correctly
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 0 items',
    );

    // Increment count
    await page.getByTestId('plural-increment').click();
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 1 item',
    );
  });

  test('component interpolation works in Suspense mode', async ({ page }) => {
    await expect(page.getByTestId('comp-single')).toContainText(
      'Click here to continue',
    );
    await expect(page.getByTestId('comp-single').locator('a')).toHaveText(
      'here',
    );
  });
});
