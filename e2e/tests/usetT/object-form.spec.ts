import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('useT Object Form - t({ id, source })', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders t({ id }) with translation', async ({ page }) => {
    await expect(page.getByTestId('uset-obj-id-only')).toContainText(
      'ID-only message',
    );
  });

  test('renders t({ id, source })', async ({ page }) => {
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      'Hello from object form!',
    );
  });

  test('renders t({ id, source, values })', async ({ page }) => {
    await expect(page.getByTestId('uset-obj-with-values')).toContainText(
      'Welcome, Tester!',
    );
  });

  test('object form works in Spanish', async ({ page }) => {
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

  test('object form works in Arabic', async ({ page }) => {
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

  test('object form updates on locale switch', async ({ page }) => {
    // English
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      'Hello from object form!',
    );

    // Spanish
    await selectLocale(page, 'es');
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      '¡Hola desde formulario objeto!',
    );

    // Back to English
    await selectLocale(page, 'en');
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      'Hello from object form!',
    );
  });
});
