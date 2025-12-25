import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Suspense Mode - Locale Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('switches between all locales', async ({ page }) => {
    // English (default)
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );

    // Spanish
    await selectLocale(page, 'es');
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );

    // Arabic
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'مرحباً بالعالم!',
    );

    // Back to English
    await selectLocale(page, 'en');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );
  });

  test('interpolation values persist through locale switch', async ({
    page,
  }) => {
    // English
    await expect(page.getByTestId('interp-simple')).toContainText(
      'Hello, Alice!',
    );

    // Spanish - same "Alice" value
    await selectLocale(page, 'es');
    await expect(page.getByTestId('interp-simple')).toContainText(
      '¡Hola, Alice!',
    );

    // Arabic - same "Alice" value
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('interp-simple')).toContainText(
      'مرحباً، Alice!',
    );
  });

  test('plural count persists through locale switch', async ({ page }) => {
    // Increment to 3
    await page.getByTestId('plural-increment').click();
    await page.getByTestId('plural-increment').click();
    await page.getByTestId('plural-increment').click();
    await expect(page.getByTestId('plural-basic')).toContainText(
      'You have 3 items',
    );

    // Spanish
    await selectLocale(page, 'es');
    await expect(page.getByTestId('plural-basic')).toContainText(
      'Tienes 3 artículos',
    );

    // Arabic (few form)
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('plural-basic')).toContainText('3 عناصر');
  });

  test('component tags remain functional after locale switch', async ({
    page,
  }) => {
    const link = page.getByTestId('comp-single-tag').locator('a');

    // English
    await expect(link).toHaveText('here');
    await expect(link).toHaveAttribute('href', '/next');

    // Spanish
    await selectLocale(page, 'es');
    await expect(link).toHaveText('aquí');
    await expect(link).toHaveAttribute('href', '/next'); // href unchanged

    // Arabic
    await selectLocale(page, 'ar');
    await expect(link).toHaveText('هنا');
    await expect(link).toHaveAttribute('href', '/next'); // href unchanged
  });

  test('rapid locale switching works correctly', async ({ page }) => {
    // Rapid switching should not cause issues
    await selectLocale(page, 'es');
    await selectLocale(page, 'ar');
    await selectLocale(page, 'en');
    await selectLocale(page, 'es');

    // Final state should be Spanish
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );
  });
});
