import { expect, test } from '@playwright/test';
import { clickNTimes, selectLocale } from '../../utils/test-helpers';

// {user.name} next to a plural: the formatjs parser rejects dotted names,
// so the plural was kept as plain text and rendered as raw ICU
test.describe('ICU Plurals - next to a dotted placeholder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the plural and the member expression', async ({ page }) => {
    await expect(page.getByTestId('plural-dotted')).toHaveText(
      'Ana has 0 tickets',
    );
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-dotted')).toHaveText(
      'Ana has 1 ticket',
    );
  });

  test('renders the Spanish plural', async ({ page }) => {
    await selectLocale(page, 'es');
    await clickNTimes(page, 'plural-increment', 1);
    await expect(page.getByTestId('plural-dotted')).toHaveText(
      'Ana tiene 1 entrada',
    );
  });
});
