import { expect, test, type Page } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

// ICU number, date and time arguments used to render as written outside a
// plural ("Total: {price, number, ::currency/EUR}") and as raw values inside
// one. The expected text is computed with the browser's own Intl.
const DAY = [2026, 10, 5, 21, 30] as const;

async function intl(page: Page, locale: string) {
  return page.evaluate(
    ({ locale, day }) => ({
      euros: new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
      }).format(1234.5),
      date: new Intl.DateTimeFormat(locale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(...day)),
      count: new Intl.NumberFormat(locale).format(1200),
    }),
    { locale, day: DAY },
  );
}

test.describe('ICU number, date and time formats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('formats a currency, a date and a plural count in English', async ({
    page,
  }) => {
    const expected = await intl(page, 'en');
    await expect(page.getByTestId('format-currency')).toHaveText(
      `Total: ${expected.euros}`,
    );
    await expect(page.getByTestId('format-date')).toHaveText(
      `On ${expected.date}`,
    );
    await expect(page.getByTestId('format-pound')).toHaveText(
      `${expected.count} tickets`,
    );
  });

  test('formats them with Spanish conventions', async ({ page }) => {
    await selectLocale(page, 'es');
    const expected = await intl(page, 'es');
    await expect(page.getByTestId('format-currency')).toHaveText(
      `Total: ${expected.euros}`,
    );
    await expect(page.getByTestId('format-date')).toHaveText(
      `El ${expected.date}`,
    );
    await expect(page.getByTestId('format-pound')).toHaveText(
      `${expected.count} entradas`,
    );
  });
});
