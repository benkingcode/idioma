import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('useT Hook - Imperative Usage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders simple message via t() function', async ({ page }) => {
    await expect(page.getByTestId('uset-simple')).toContainText(
      'Hello from useT!',
    );
  });

  test('renders message with placeholder via t() function', async ({
    page,
  }) => {
    await expect(page.getByTestId('uset-interpolation')).toContainText(
      'Welcome, Developer!',
    );
  });

  test('renders message with multiple placeholders', async ({ page }) => {
    await expect(page.getByTestId('uset-multiple')).toContainText(
      '42 items by Admin',
    );
  });

  test('renders inline t() call', async ({ page }) => {
    await expect(page.getByTestId('uset-inline')).toContainText(
      'Inline translation',
    );
  });

  test('t() function works in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');
    await expect(page.getByTestId('uset-simple')).toContainText(
      '¡Hola desde useT!',
    );
    await expect(page.getByTestId('uset-interpolation')).toContainText(
      '¡Bienvenido, Developer!',
    );
  });

  test('t() function works in Arabic', async ({ page }) => {
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('uset-simple')).toContainText(
      'مرحبا من useT!',
    );
    await expect(page.getByTestId('uset-interpolation')).toContainText(
      'أهلا وسهلا، Developer!',
    );
  });

  test('t() function updates on locale switch', async ({ page }) => {
    // English
    await expect(page.getByTestId('uset-simple')).toContainText(
      'Hello from useT!',
    );

    // Spanish
    await selectLocale(page, 'es');
    await expect(page.getByTestId('uset-simple')).toContainText(
      '¡Hola desde useT!',
    );

    // Arabic
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('uset-simple')).toContainText(
      'مرحبا من useT!',
    );

    // Back to English
    await selectLocale(page, 'en');
    await expect(page.getByTestId('uset-simple')).toContainText(
      'Hello from useT!',
    );
  });
});
