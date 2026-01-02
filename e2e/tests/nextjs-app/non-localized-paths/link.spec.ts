import { expect, test } from '@playwright/test';

/**
 * Next.js Link Component E2E Tests for Non-Localized Paths
 *
 * These tests verify that the Link component correctly generates
 * non-localized href attributes (prefix-only, no path translation).
 */

test.describe('Next.js Link Component - Non-Localized Paths', () => {
  test.describe('English Locale (Default)', () => {
    test('navigation links use canonical paths without prefix', async ({
      page,
    }) => {
      await page.goto('/');

      // With as-needed prefix strategy, English links should not have /en prefix
      const aboutLink = page.getByTestId('nav-about');
      const blogLink = page.getByTestId('nav-blog');
      const contactLink = page.getByTestId('nav-contact');

      await expect(aboutLink).toHaveAttribute('href', '/about');
      await expect(blogLink).toHaveAttribute('href', '/blog');
      await expect(contactLink).toHaveAttribute('href', '/contact');
    });
  });

  test.describe('Spanish Locale', () => {
    test('navigation links use canonical paths with /es prefix', async ({
      page,
    }) => {
      await page.goto('/es');

      // Non-localized paths: use canonical paths with locale prefix
      const aboutLink = page.getByTestId('nav-about');
      const blogLink = page.getByTestId('nav-blog');
      const contactLink = page.getByTestId('nav-contact');

      // Should be /es/about, not /es/sobre
      await expect(aboutLink).toHaveAttribute('href', '/es/about');
      // Should be /es/blog, not /es/articulos
      await expect(blogLink).toHaveAttribute('href', '/es/blog');
      // Should be /es/contact, not /es/contacto
      await expect(contactLink).toHaveAttribute('href', '/es/contact');
    });
  });

  test.describe('Link Navigation', () => {
    test('clicking Spanish link navigates to canonical path with prefix', async ({
      page,
    }) => {
      await page.goto('/es');

      await page.getByTestId('nav-about').click();

      // URL should use canonical path structure
      await expect(page).toHaveURL(/\/es\/about$/);
      await expect(page.getByTestId('about-page')).toBeVisible();
      await expect(page.getByTestId('about-title')).toContainText(
        'Acerca de nuestra empresa',
      );
    });

    test('link navigation preserves locale in subsequent links', async ({
      page,
    }) => {
      await page.goto('/es');

      await page.getByTestId('nav-about').click();
      await expect(page).toHaveURL(/\/es\/about$/);

      // After navigating, links should still have /es prefix
      const blogLink = page.getByTestId('nav-blog');
      await expect(blogLink).toHaveAttribute('href', '/es/blog');
    });
  });

  test.describe('Never Prefix Strategy', () => {
    test('links have no locale prefix regardless of locale', async ({
      page,
    }, testInfo) => {
      test.skip(
        !testInfo.project.name.includes('never'),
        'Only runs for never prefix strategy',
      );

      await page.goto('/');

      const aboutLink = page.getByTestId('nav-about');

      // With never strategy, no locale prefix
      await expect(aboutLink).toHaveAttribute('href', '/about');
    });
  });
});
