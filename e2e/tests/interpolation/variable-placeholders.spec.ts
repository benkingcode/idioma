import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Interpolation - Variable Placeholders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders simple name placeholder in English', async ({ page }) => {
    await expect(page.getByTestId('interp-simple')).toContainText(
      'Hello, Alice!',
    );
  });

  test('renders multiple placeholders in English', async ({ page }) => {
    await expect(page.getByTestId('interp-multiple')).toContainText(
      'Welcome, John Doe!',
    );
  });

  test('renders placeholder with surrounding text', async ({ page }) => {
    await expect(page.getByTestId('interp-surrounding')).toContainText(
      'Before Bob after',
    );
  });

  test('renders numeric placeholder', async ({ page }) => {
    await expect(page.getByTestId('interp-numeric')).toContainText(
      'You have 42 items',
    );
  });

  test('interpolation works in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');
    await expect(page.getByTestId('interp-simple')).toContainText(
      '¡Hola, Alice!',
    );
    await expect(page.getByTestId('interp-multiple')).toContainText(
      '¡Bienvenido, John Doe!',
    );
  });

  test('interpolation works in Arabic', async ({ page }) => {
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('interp-simple')).toContainText(
      'مرحباً، Alice!',
    );
    await expect(page.getByTestId('interp-multiple')).toContainText(
      'أهلاً، John Doe!',
    );
  });

  test('interpolation persists through locale switches', async ({ page }) => {
    // English
    await expect(page.getByTestId('interp-simple')).toContainText(
      'Hello, Alice!',
    );

    // Spanish
    await selectLocale(page, 'es');
    await expect(page.getByTestId('interp-simple')).toContainText(
      '¡Hola, Alice!',
    );

    // Arabic
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('interp-simple')).toContainText(
      'مرحباً، Alice!',
    );

    // Back to English
    await selectLocale(page, 'en');
    await expect(page.getByTestId('interp-simple')).toContainText(
      'Hello, Alice!',
    );
  });
});
