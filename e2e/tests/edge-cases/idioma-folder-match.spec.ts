import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

// src/idioma-legacy is not the idioma folder src/idioma: its Trans must not
// be rewritten into Idioma's
test.describe('A folder whose name starts like the idioma folder', () => {
  test('keeps its own Trans in every locale', async ({ page }) => {
    await page.goto('/');
    const legacy = page.getByTestId('legacy-trans');
    await expect(legacy).toHaveText('[legacy] Hello, World!');
    await selectLocale(page, 'es');
    await expect(legacy).toHaveText('[legacy] Hello, World!');
  });
});
