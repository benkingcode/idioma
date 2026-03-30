import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

test.describe('Trans Component - Basic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders simple text in default locale (en)', async ({ page }) => {
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );
  });

  test('renders welcome message', async ({ page }) => {
    await expect(page.getByTestId('basic-welcome')).toContainText(
      'Welcome to our application',
    );
  });

  test('renders message with explicit ID', async ({ page }) => {
    await expect(page.getByTestId('basic-explicit-id')).toContainText(
      'Goodbye!',
    );
  });

  test('switches to Spanish locale', async ({ page }) => {
    await selectLocale(page, 'es');
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );
    await expect(page.getByTestId('basic-welcome')).toContainText(
      'Bienvenido a nuestra aplicación',
    );
    await expect(page.getByTestId('basic-explicit-id')).toContainText(
      '¡Adiós!',
    );
  });

  test('switches to Arabic locale', async ({ page }) => {
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'مرحبا، العالم!',
    );
    await expect(page.getByTestId('basic-welcome')).toContainText(
      'مرحبا بك في تطبيقنا',
    );
    await expect(page.getByTestId('basic-explicit-id')).toContainText('وداعا!');
  });

  test('switches back to English from Spanish', async ({ page }) => {
    await selectLocale(page, 'es');
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );

    await selectLocale(page, 'en');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );
  });

  test('switches between all locales', async ({ page }) => {
    // Start with English
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );

    // Switch to Spanish
    await selectLocale(page, 'es');
    await expect(page.getByTestId('basic-hello')).toContainText(
      '¡Hola, Mundo!',
    );

    // Switch to Arabic
    await selectLocale(page, 'ar');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'مرحبا، العالم!',
    );

    // Switch back to English
    await selectLocale(page, 'en');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );
  });
});
