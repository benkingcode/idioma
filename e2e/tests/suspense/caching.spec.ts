import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Suspense Mode - Caching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('switching to previously loaded locale uses cache', async ({ page }) => {
    // Load Spanish
    await selectLocale(page, 'es');
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );

    // Switch to Arabic
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'مرحبا، العالم!',
    );

    // Switch back to Spanish (should use cache, no network request)
    await selectLocale(page, 'es');
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );
  });

  test('multiple locale switches maintain cached translations', async ({
    page,
  }) => {
    // Cycle through all locales multiple times
    for (let i = 0; i < 3; i++) {
      await selectLocale(page, 'es');
      await expect(page.getByTestId('basic-hello')).toContainText(
        '¡Hola, Mundo!',
      );

      await selectLocale(page, 'ar');
      await expect(page.getByTestId('basic-hello')).toContainText(
        'مرحبا، العالم!',
      );

      await selectLocale(page, 'en');
      await expect(page.getByTestId('basic-hello')).toContainText(
        'Hello, World!',
      );
    }
  });

  test('cached translations include all message types', async ({ page }) => {
    // Load Spanish and verify all message types work
    await selectLocale(page, 'es');

    // Basic trans
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );

    // Interpolation
    await expect(page.getByTestId('interp-simple')).toContainText(
      '¡Hola, Alice!',
    );

    // Plurals
    await page.getByTestId('plural-increment').click();
    await expect(page.getByTestId('plural-basic')).toContainText(
      'Tienes 1 elemento',
    );

    // Component tags
    await expect(page.getByTestId('comp-single')).toContainText(
      'Haz clic aquí para continuar',
    );

    // Switch away and back
    await selectLocale(page, 'en');
    await selectLocale(page, 'es');

    // All should still work from cache
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );
    await expect(page.getByTestId('interp-simple')).toContainText(
      '¡Hola, Alice!',
    );
    await expect(page.getByTestId('plural-basic')).toContainText(
      'Tienes 1 elemento',
    );
    await expect(page.getByTestId('comp-single')).toContainText(
      'Haz clic aquí para continuar',
    );
  });
});
