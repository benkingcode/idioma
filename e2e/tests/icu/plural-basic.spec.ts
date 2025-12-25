import { expect, test } from '@playwright/test';
import { clickNTimes, selectLocale } from '../../utils/test-helpers';

test.describe('ICU Plurals - Basic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders singular form (one) correctly', async ({ page }) => {
    // Initial count is 0, click once to get to 1
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 1 item',
    );
  });

  test('renders plural form (other) for zero', async ({ page }) => {
    // Initial count is 0
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 0 items',
    );
  });

  test('renders plural form (other) for multiple', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 5);
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 5 items',
    );
  });

  test('zero form works when defined', async ({ page }) => {
    // Initial count is 0
    await expect(page.getByTestId('plural-zero')).toContainText('No messages');
  });

  test('zero form transitions to one correctly', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-zero')).toContainText('1 message');
  });

  test('zero form transitions to other correctly', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 3);
    await expect(page.getByTestId('plural-zero')).toContainText('3 messages');
  });

  test('plural with surrounding text', async ({ page }) => {
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-surrounded')).toContainText(
      'There is 1 apple in the basket',
    );

    await clickNTimes(page, 'plural-increment', 2);
    await expect(page.getByTestId('plural-surrounded')).toContainText(
      'There are 3 apples in the basket',
    );
  });

  test('plurals work in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');

    // Zero - uses 'other' in Spanish (no zero form needed)
    await expect(page.getByTestId('plural-basic')).toContainText(
      'Tienes 0 artículos',
    );

    // One
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-basic')).toContainText(
      'Tienes 1 artículo',
    );

    // Other
    await clickNTimes(page, 'plural-increment', 4);
    await expect(page.getByTestId('plural-basic')).toContainText(
      'Tienes 5 artículos',
    );
  });

  test('plurals work in Arabic with full CLDR forms', async ({ page }) => {
    await selectLocale(page, 'ar');

    // Zero (Arabic has explicit zero form)
    await expect(page.getByTestId('plural-basic')).toContainText('لا عناصر');

    // One
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-basic')).toContainText('عنصر واحد');

    // Two (Arabic has explicit two form)
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-basic')).toContainText('عنصران');

    // Few (3-10 in Arabic)
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-basic')).toContainText('3 عناصر');

    // Many (11-99 in Arabic)
    await clickNTimes(page, 'plural-increment', 8);
    await expect(page.getByTestId('plural-basic')).toContainText('11 عنصر');
  });

  test('plurals update dynamically when count changes', async ({ page }) => {
    // Start at 0
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 0 items',
    );

    // Increment to 1
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 1 item',
    );

    // Increment to 2
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 2 items',
    );

    // Decrement back to 0
    await clickNTimes(page, 'plural-decrement', 2);
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 0 items',
    );
  });
});
