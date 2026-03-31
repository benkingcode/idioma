import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Suspense Mode - useT String Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders English translations from chunk', async ({ page }) => {
    await expect(page.getByTestId('uset-simple')).toContainText(
      'Hello from useT!',
    );
    await expect(page.getByTestId('uset-interpolation')).toContainText(
      'Welcome, Developer!',
    );
    await expect(page.getByTestId('uset-multiple')).toContainText(
      '42 items by Admin',
    );
    await expect(page.getByTestId('uset-inline')).toContainText(
      'Inline translation',
    );
  });

  test('renders Spanish translations after locale switch', async ({ page }) => {
    await selectLocale(page, 'es');

    await expect(page.getByTestId('uset-simple')).toContainText(
      '¡Hola desde useT!',
    );
    await expect(page.getByTestId('uset-interpolation')).toContainText(
      '¡Bienvenido, Developer!',
    );
    await expect(page.getByTestId('uset-multiple')).toContainText(
      '42 elementos de Admin',
    );
    await expect(page.getByTestId('uset-inline')).toContainText(
      'Traducción en línea',
    );
  });

  test('renders Arabic translations after locale switch', async ({ page }) => {
    await selectLocale(page, 'ar');

    await expect(page.getByTestId('uset-simple')).toContainText(
      'مرحبا من useT!',
    );
    await expect(page.getByTestId('uset-interpolation')).toContainText(
      'أهلا وسهلا، Developer!',
    );
    await expect(page.getByTestId('uset-multiple')).toContainText(
      '42 عنصر بواسطة Admin',
    );
    await expect(page.getByTestId('uset-inline')).toContainText(
      'الترجمة المضمنة',
    );
  });
});
