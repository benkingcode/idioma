import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('handles empty string placeholder', async ({ page }) => {
    // Empty string should be interpolated as empty
    await expect(page.getByTestId('edge-empty')).toContainText('Value: []');
  });

  test('handles zero as placeholder', async ({ page }) => {
    // Zero should be displayed, not treated as falsy
    await expect(page.getByTestId('edge-zero')).toContainText('Count: 0');
  });

  test('handles null placeholder', async ({ page }) => {
    // Null renders as the string "null" (current behavior)
    await expect(page.getByTestId('edge-null')).toContainText('Null: [null]');
  });

  test('handles long text content', async ({ page }) => {
    await expect(page.getByTestId('edge-long')).toContainText(
      'This is a longer piece of text that spans multiple words and tests how the system handles longer content in translations',
    );
  });

  test('handles special characters', async ({ page }) => {
    await expect(page.getByTestId('edge-special')).toContainText(
      'Special: & < > "quotes"',
    );
  });

  test('handles emoji and symbols', async ({ page }) => {
    await expect(page.getByTestId('edge-unicode')).toContainText(
      'Emoji: 🎉 and symbols: © ® ™',
    );
  });

  test('edge cases work in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');

    await expect(page.getByTestId('edge-empty')).toContainText('Valor: []');
    await expect(page.getByTestId('edge-zero')).toContainText('Cantidad: 0');
    await expect(page.getByTestId('edge-special')).toContainText(
      'Especial: & < > "comillas"',
    );
    await expect(page.getByTestId('edge-unicode')).toContainText(
      'Emoji: 🎉 y símbolos: © ® ™',
    );
  });

  test('edge cases work in Arabic', async ({ page }) => {
    await selectLocale(page, 'ar');

    await expect(page.getByTestId('edge-empty')).toContainText('القيمة: []');
    await expect(page.getByTestId('edge-zero')).toContainText('العدد: 0');
    await expect(page.getByTestId('edge-special')).toContainText(
      'خاص: & < > "علامات الاقتباس"',
    );
    await expect(page.getByTestId('edge-unicode')).toContainText(
      'رموز تعبيرية: 🎉 والرموز: © ® ™',
    );
  });
});
