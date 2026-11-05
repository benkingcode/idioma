import { expect, test } from '@playwright/test';
import { clickNTimes, selectLocale } from '../../utils/test-helpers';

// A compiled plural used to return its text with every tag dropped, so
// "See <Link>your cart</Link>" rendered as "See " with no link
test.describe('Component tags next to and inside a plural', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('keeps the link next to a plural', async ({ page }) => {
    const message = page.getByTestId('comp-plural');
    await expect(message).toHaveText('You have 1 item. See your cart');
    await expect(
      message.getByRole('link', { name: 'your cart' }),
    ).toBeVisible();
    await clickNTimes(page, 'comp-plural-increment', 1);
    await expect(message).toHaveText('You have 2 items. See your cart');
  });

  test('renders a link the translation moved into the branches', async ({
    page,
  }) => {
    await selectLocale(page, 'es');
    const message = page.getByTestId('comp-plural');
    await expect(message).toHaveText('Tienes 1 artículo. Mira tu carrito');
    await expect(
      message.getByRole('link', { name: 'tu carrito' }),
    ).toBeVisible();
    await clickNTimes(page, 'comp-plural-increment', 1);
    await expect(message).toHaveText('Tienes 2 artículos. Mira tu carrito');
  });
});
