import { expect, test } from '@playwright/test';
import { setAcceptLanguage } from '../../helpers/accept-language';

/**
 * Tests specific to the 'always' prefix strategy.
 *
 * always behavior:
 * - ALL locales have a prefix, including default (en)
 * - / redirects to /en/ (or detected locale)
 * - /about redirects to /en/about
 */
test.describe('Prefix Strategy: always', () => {
  test.describe('Root Redirects', () => {
    test('root URL redirects to default locale prefix', async ({ page }) => {
      await page.goto('/');
      // Should redirect to /en/ (or /es/ if Accept-Language prefers Spanish)
      await expect(page).toHaveURL(/\/(en|es)/);
    });

    test('root with English Accept-Language redirects to /en', async ({
      page,
    }) => {
      await setAcceptLanguage(page, 'en-US,en;q=0.9');
      await page.goto('/');
      await expect(page).toHaveURL(/\/en/);
    });

    test('root with Spanish Accept-Language redirects to /es', async ({
      page,
    }) => {
      await setAcceptLanguage(page, 'es-ES,es;q=0.9');
      await page.goto('/');
      await expect(page).toHaveURL(/\/es/);
    });
  });

  test.describe('All Locales Have Prefix', () => {
    test('English pages require /en prefix', async ({ page }) => {
      await page.goto('/en');
      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
      expect(page.url()).toMatch(/\/en/);
    });

    test('Spanish pages require /es prefix', async ({ page }) => {
      await page.goto('/es');
      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('canonical path without prefix redirects to prefixed', async ({
      page,
    }) => {
      await setAcceptLanguage(page, 'en-US,en;q=0.9');
      await page.goto('/about');
      // Should redirect to /en/about
      await expect(page).toHaveURL(/\/en\/about/);
    });
  });

  test.describe('Locale Switching', () => {
    test('switching from English to Spanish changes prefix', async ({
      page,
    }) => {
      await page.goto('/en');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-es').click();
      await expect(page).toHaveURL(/\/es/);
    });

    test('switching from Spanish to English changes prefix', async ({
      page,
    }) => {
      await page.goto('/es');
      await page.waitForSelector('[data-hydrated="true"]', {
        state: 'attached',
      });
      await page.getByTestId('locale-en').click();
      // Should go to /en/ NOT /
      await expect(page).toHaveURL(/\/en/);
    });
  });

  test.describe('Link Href Generation', () => {
    test('links in English include /en prefix', async ({ page }) => {
      await page.goto('/en');

      const homeLink = page.getByTestId('nav-home');
      const href = await homeLink.getAttribute('href');

      // Should be /en/ not /
      expect(href).toMatch(/^\/en/);
    });

    test('links in Spanish include /es prefix', async ({ page }) => {
      await page.goto('/es');

      const aboutLink = page.getByTestId('nav-about');
      const href = await aboutLink.getAttribute('href');

      expect(href).toMatch(/^\/es\//);
    });
  });

  test.describe('Cookie + Always Strategy', () => {
    test('cookie preference redirects to correct prefixed locale', async ({
      page,
    }) => {
      await page.context().addCookies([
        {
          name: 'IDIOMI_LOCALE',
          value: 'es',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/');
      // Should redirect to /es/ based on cookie
      await expect(page).toHaveURL(/\/es/);
    });
  });
});
