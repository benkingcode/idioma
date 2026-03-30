import { expect, test } from '@playwright/test';
import { clickNTimes, selectLocale } from '../../utils/test-helpers';

test.describe('ICU Plurals - CLDR Arabic Forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectLocale(page, 'ar');
  });

  // Arabic has 6 plural forms: zero, one, two, few, many, other
  // This test validates all of them

  test('zero form (0)', async ({ page }) => {
    // Initial count is 0
    await expect(page.getByTestId('plural-cldr')).toContainText(
      '0 ملفات (صفر)',
    );
  });

  test('one form (1)', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-cldr')).toContainText('1 ملف (واحد)');
  });

  test('two form (2)', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 2);
    await expect(page.getByTestId('plural-cldr')).toContainText(
      '2 ملفان (اثنان)',
    );
  });

  test('few form (3-10)', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 3);
    await expect(page.getByTestId('plural-cldr')).toContainText(
      '3 ملفات (قليل)',
    );

    await clickNTimes(page, 'plural-increment', 7);
    await expect(page.getByTestId('plural-cldr')).toContainText(
      '10 ملفات (قليل)',
    );
  });

  test('many form (11-99)', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 11);
    await expect(page.getByTestId('plural-cldr')).toContainText(
      '11 ملفات (كثير)',
    );

    await clickNTimes(page, 'plural-increment', 88);
    await expect(page.getByTestId('plural-cldr')).toContainText(
      '99 ملفات (كثير)',
    );
  });

  test('other form (100+)', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 100);
    await expect(page.getByTestId('plural-cldr')).toContainText(
      '100 ملفات (آخر)',
    );
  });

  test('transitions correctly between all forms', async ({ page }) => {
    // Zero
    await expect(page.getByTestId('plural-cldr')).toContainText('(صفر)');

    // One
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-cldr')).toContainText('(واحد)');

    // Two
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-cldr')).toContainText('(اثنان)');

    // Few
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-cldr')).toContainText('(قليل)');

    // Many (jump to 11)
    await clickNTimes(page, 'plural-increment', 8);
    await expect(page.getByTestId('plural-cldr')).toContainText('(كثير)');

    // Other (jump to 100)
    await clickNTimes(page, 'plural-increment', 89);
    await expect(page.getByTestId('plural-cldr')).toContainText('(آخر)');
  });
});
