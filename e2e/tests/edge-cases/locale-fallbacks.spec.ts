import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Locale fallbacks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a regional locale falls back to its base locale', async ({ page }) => {
    await selectLocale(page, 'es-MX');
    await expect(page.getByTestId('basic-hello')).toHaveText('¡Hola, Mundo!');
    await expect(page.getByTestId('uset-obj-id-only')).toHaveText(
      'Mensaje solo con ID',
    );
    await expect(page.getByTestId('createt-plural')).toHaveText('Queda 1 día');
  });

  test('a key with no English text renders its id, not Spanish (#8)', async ({
    page,
  }) => {
    await expect(page.getByTestId('fallback-spanish-only')).toHaveText(
      'fallback.spanishOnly',
    );
  });

  test('Arabic never borrows the Spanish translation (#8)', async ({
    page,
  }) => {
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('fallback-spanish-only')).toHaveText(
      'fallback.spanishOnly',
    );
  });

  test('the translated locale still renders its text', async ({ page }) => {
    await selectLocale(page, 'es');
    await expect(page.getByTestId('fallback-spanish-only')).toHaveText(
      'Solo en español',
    );
  });
});
