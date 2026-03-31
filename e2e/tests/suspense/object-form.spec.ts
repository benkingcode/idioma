import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Suspense Mode - useT Object Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders English translations from chunk', async ({ page }) => {
    await expect(page.getByTestId('uset-obj-id-only')).toContainText(
      'ID-only message',
    );
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      'Hello from object form!',
    );
    await expect(page.getByTestId('uset-obj-with-values')).toContainText(
      'Welcome, Tester!',
    );
  });

  test('renders Spanish translations after locale switch', async ({ page }) => {
    await selectLocale(page, 'es');

    await expect(page.getByTestId('uset-obj-id-only')).toContainText(
      'Mensaje solo con ID',
    );
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      '¡Hola desde formulario objeto!',
    );
    await expect(page.getByTestId('uset-obj-with-values')).toContainText(
      '¡Bienvenido, Tester!',
    );
  });

  test('renders Arabic translations after locale switch', async ({ page }) => {
    await selectLocale(page, 'ar');

    await expect(page.getByTestId('uset-obj-id-only')).toContainText(
      'رسالة معرّف فقط',
    );
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      'مرحبًا من نموذج الكائن!',
    );
    await expect(page.getByTestId('uset-obj-with-values')).toContainText(
      'مرحبًا، Tester!',
    );
  });
});
