import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Interpolation - Intrinsic HTML Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders intrinsic span element inside Trans', async ({ page }) => {
    const container = page.getByTestId('intrinsic-span');
    await expect(container).toContainText(
      'We charge a 10% fee (£1 minimum) per ticket',
    );
    // Verify the span is rendered as an actual DOM element
    await expect(container.locator('span')).toHaveText('(£1 minimum)');
  });

  test('renders mixed custom components and intrinsic elements', async ({
    page,
  }) => {
    const container = page.getByTestId('intrinsic-mixed');
    await expect(container).toContainText('Click here or there');
    // Custom component renders as <a>
    await expect(container.locator('a')).toHaveText('here');
    // Intrinsic element renders as <span>
    await expect(container.locator('span')).toHaveText('there');
  });

  test('intrinsic elements work in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');

    const spanContainer = page.getByTestId('intrinsic-span');
    await expect(spanContainer).toContainText(
      'Cobramos una tarifa del 10% (£1 mínimo) por boleto',
    );
    await expect(spanContainer.locator('span')).toHaveText('(£1 mínimo)');

    const mixedContainer = page.getByTestId('intrinsic-mixed');
    await expect(mixedContainer).toContainText('Haz clic aquí o allí');
    await expect(mixedContainer.locator('a')).toHaveText('aquí');
    await expect(mixedContainer.locator('span')).toHaveText('allí');
  });

  test('intrinsic elements work in Arabic', async ({ page }) => {
    await selectLocale(page, 'ar');

    const mixedContainer = page.getByTestId('intrinsic-mixed');
    await expect(mixedContainer.locator('a')).toHaveText('هنا');
    await expect(mixedContainer.locator('span')).toHaveText('هناك');
  });

  test('no console errors from intrinsic elements', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page.getByTestId('intrinsic-span')).toBeVisible();

    // No ReferenceError or other errors should occur
    expect(errors).toHaveLength(0);
  });
});
