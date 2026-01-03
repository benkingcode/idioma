import { expect, test } from '@playwright/test';
import { setAcceptLanguage } from '../../helpers/accept-language';

test.describe('Accept-Language Header Detection', () => {
  test.describe('First Visit (No Cookie)', () => {
    test('detects Spanish from Accept-Language header', async ({ page }) => {
      // Set Accept-Language header to prefer Spanish
      await setAcceptLanguage(page, 'es-ES,es;q=0.9,en;q=0.8');

      // Visit root without any locale
      await page.goto('/');

      // Should redirect to Spanish based on Accept-Language
      await expect(page).toHaveURL(/\/es/);
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('detects English from Accept-Language header', async ({ page }) => {
      // Set Accept-Language header to prefer English
      await setAcceptLanguage(page, 'en-US,en;q=0.9');

      // Visit root without any locale
      await page.goto('/');

      // Should stay at root (English is default, no prefix needed with as-needed)
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });

    test('falls back to default locale for unsupported language', async ({
      page,
    }) => {
      // Set Accept-Language header to an unsupported language
      await setAcceptLanguage(page, 'fr-FR,fr;q=0.9,de;q=0.8');

      // Visit root without any locale
      await page.goto('/');

      // Should fall back to English (default locale)
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });

    test('handles complex Accept-Language with quality values', async ({
      page,
    }) => {
      // Spanish has higher quality than English
      await setAcceptLanguage(page, 'fr;q=0.5,es;q=0.9,en;q=0.7');

      await page.goto('/');

      // Should pick Spanish (highest quality among supported locales)
      await expect(page).toHaveURL(/\/es/);
    });
  });

  test.describe('Cookie Takes Precedence', () => {
    test('cookie overrides Accept-Language header', async ({ page }) => {
      // Set Accept-Language to Spanish
      await setAcceptLanguage(page, 'es-ES,es;q=0.9');

      // Set cookie to English
      await page.context().addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'en',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/');

      // Cookie should override Accept-Language, stay in English
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });

    test('URL locale overrides both cookie and Accept-Language', async ({
      page,
    }) => {
      // Set Accept-Language to English
      await setAcceptLanguage(page, 'en-US,en;q=0.9');

      // Set cookie to English
      await page.context().addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'en',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Explicitly visit Spanish URL
      await page.goto('/es');

      // URL should take precedence - content should be Spanish
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });
  });

  test.describe('BCP 47 Language Matching', () => {
    test('matches regional variant to base language', async ({ page }) => {
      // es-MX (Mexican Spanish) should match es
      await setAcceptLanguage(page, 'es-MX');

      await page.goto('/');

      await expect(page).toHaveURL(/\/es/);
    });

    test('matches en-GB to en', async ({ page }) => {
      await setAcceptLanguage(page, 'en-GB');

      await page.goto('/');

      // Should match English
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });
  });
});
