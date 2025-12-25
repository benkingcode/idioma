import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Interpolation - Component Tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders single component tag with link', async ({ page }) => {
    const container = page.getByTestId('comp-single-tag');
    await expect(container).toContainText('Click here to continue');
    // Verify the link is rendered
    await expect(container.locator('a')).toHaveText('here');
    await expect(container.locator('a')).toHaveAttribute('href', '/next');
  });

  test('renders multiple component tags', async ({ page }) => {
    const container = page.getByTestId('comp-multiple-tags');
    await expect(container).toContainText('Read the terms and privacy policy');
    // Verify both links are rendered
    const links = container.locator('a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveText('terms');
    await expect(links.nth(1)).toHaveText('privacy policy');
  });

  test('renders component tag with placeholder inside', async ({ page }) => {
    const container = page.getByTestId('comp-with-placeholder');
    await expect(container).toContainText('Hello Charlie!');
    // Verify the strong tag wraps the name
    await expect(container.locator('strong')).toHaveText('Charlie');
  });

  test('renders multiple formatting tags', async ({ page }) => {
    const container = page.getByTestId('comp-formatting');
    await expect(container).toContainText(
      'This is bold, this is italic, and normal',
    );
    await expect(container.locator('strong')).toHaveText('bold');
    await expect(container.locator('em')).toHaveText('italic');
  });

  test('renders nested component tags', async ({ page }) => {
    const container = page.getByTestId('comp-nested');
    await expect(container).toContainText('Important: read carefully');
    // Verify nesting structure
    await expect(container.locator('div > em')).toContainText('read carefully');
  });

  test('component tags work in Spanish', async ({ page }) => {
    await selectLocale(page, 'es');

    const singleTag = page.getByTestId('comp-single-tag');
    await expect(singleTag).toContainText('Haz clic aquí para continuar');
    await expect(singleTag.locator('a')).toHaveText('aquí');

    const multipleTags = page.getByTestId('comp-multiple-tags');
    await expect(multipleTags).toContainText(
      'Lee los términos y la política de privacidad',
    );
  });

  test('component tags work in Arabic', async ({ page }) => {
    await selectLocale(page, 'ar');

    const singleTag = page.getByTestId('comp-single-tag');
    await expect(singleTag).toContainText('انقر هنا للمتابعة');
    await expect(singleTag.locator('a')).toHaveText('هنا');

    const multipleTags = page.getByTestId('comp-multiple-tags');
    await expect(multipleTags).toContainText('اقرأ الشروط وسياسة الخصوصية');
  });

  test('component tags persist through locale switches', async ({ page }) => {
    const container = page.getByTestId('comp-single-tag');

    // English
    await expect(container.locator('a')).toHaveText('here');

    // Spanish
    await selectLocale(page, 'es');
    await expect(container.locator('a')).toHaveText('aquí');

    // Arabic
    await selectLocale(page, 'ar');
    await expect(container.locator('a')).toHaveText('هنا');

    // Back to English
    await selectLocale(page, 'en');
    await expect(container.locator('a')).toHaveText('here');
  });
});
