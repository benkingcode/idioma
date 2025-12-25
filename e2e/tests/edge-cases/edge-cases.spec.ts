import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('handles empty string placeholder', async ({ page }) => {
    // Empty string should be interpolated as empty
    await expect(page.getByTestId('edge-empty-string')).toContainText(
      'Value: []',
    );
  });

  test('handles zero as placeholder', async ({ page }) => {
    // Zero should be displayed, not treated as falsy
    await expect(page.getByTestId('edge-zero')).toContainText('Count: 0');
  });

  test('handles null placeholder', async ({ page }) => {
    // Null should be converted to empty string
    await expect(page.getByTestId('edge-null')).toContainText('Null: []');
  });

  test('handles long text content', async ({ page }) => {
    await expect(page.getByTestId('edge-long-text')).toContainText(
      'This is a longer piece of text that spans multiple words and tests how the system handles longer content in translations',
    );
  });

  test('handles special characters', async ({ page }) => {
    await expect(page.getByTestId('edge-special-chars')).toContainText(
      'Special: & < > "quotes"',
    );
  });

  test('handles emoji and symbols', async ({ page }) => {
    await expect(page.getByTestId('edge-emoji')).toContainText(
      'Emoji: 🎉 and symbols: © ® ™',
    );
  });

  test('edge cases work in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');

    await expect(page.getByTestId('edge-empty-string')).toContainText(
      'Valor: []',
    );
    await expect(page.getByTestId('edge-zero')).toContainText('Cuenta: 0');
    await expect(page.getByTestId('edge-special-chars')).toContainText(
      'Especial: & < > "comillas"',
    );
    await expect(page.getByTestId('edge-emoji')).toContainText(
      'Emoji: 🎉 y símbolos: © ® ™',
    );
  });

  test('edge cases work in Arabic', async ({ page }) => {
    await selectLocale(page, 'ar');

    await expect(page.getByTestId('edge-empty-string')).toContainText(
      'القيمة: []',
    );
    await expect(page.getByTestId('edge-zero')).toContainText('العدد: 0');
    await expect(page.getByTestId('edge-special-chars')).toContainText(
      'خاص: & < > "اقتباسات"',
    );
    await expect(page.getByTestId('edge-emoji')).toContainText(
      'إيموجي: 🎉 ورموز: © ® ™',
    );
  });
});
