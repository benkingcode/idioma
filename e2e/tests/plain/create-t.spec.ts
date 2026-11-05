import { expect, test } from '@playwright/test';
import { clickNTimes, selectLocale } from '../../utils/test-helpers';

// createT is what server functions and emails call. A plural is compiled to
// a function, and createT used to treat it as a string and throw.
test.describe('createT - compiled plurals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the one form', async ({ page }) => {
    await expect(page.getByTestId('createt-plural')).toHaveText('1 day left');
  });

  test('renders the other form', async ({ page }) => {
    await clickNTimes(page, 'createt-increment', 2);
    await expect(page.getByTestId('createt-plural')).toHaveText('3 days left');
  });

  test('renders the plural in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');
    await expect(page.getByTestId('createt-plural')).toHaveText('Queda 1 día');
    await clickNTimes(page, 'createt-increment', 1);
    await expect(page.getByTestId('createt-plural')).toHaveText(
      'Quedan 2 días',
    );
  });

  test('renders the Arabic two form', async ({ page }) => {
    await selectLocale(page, 'ar');
    await clickNTimes(page, 'createt-increment', 1);
    await expect(page.getByTestId('createt-plural')).toHaveText('بقي يومان');
  });
});
