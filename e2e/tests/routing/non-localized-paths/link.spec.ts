import { expect, test } from '@playwright/test';

test.describe('Link Component - Non-Localized Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders links with no prefix in default locale', async ({ page }) => {
    // English (default) should have no prefix
    await expect(page.getByTestId('nav-home')).toHaveAttribute('href', '/');
    await expect(page.getByTestId('nav-about')).toHaveAttribute(
      'href',
      '/about',
    );
    await expect(page.getByTestId('nav-blog')).toHaveAttribute('href', '/blog');
    await expect(page.getByTestId('nav-contact')).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  test('renders links with prefix only (not translated) in Spanish locale', async ({
    page,
  }) => {
    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Spanish should use prefix but NOT translate paths
    await expect(page.getByTestId('nav-home')).toHaveAttribute('href', '/es');
    await expect(page.getByTestId('nav-about')).toHaveAttribute(
      'href',
      '/es/about',
    );
    await expect(page.getByTestId('nav-blog')).toHaveAttribute(
      'href',
      '/es/blog',
    );
    await expect(page.getByTestId('nav-contact')).toHaveAttribute(
      'href',
      '/es/contact',
    );
  });

  test('does NOT translate paths - about stays about', async ({ page }) => {
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // About should NOT become "sobre"
    await expect(page.getByTestId('nav-about')).toHaveAttribute(
      'href',
      '/es/about',
    );
    await expect(page.getByTestId('nav-about')).not.toHaveAttribute(
      'href',
      '/es/sobre',
    );

    // Blog should NOT become "articulos"
    await expect(page.getByTestId('nav-blog')).toHaveAttribute(
      'href',
      '/es/blog',
    );
    await expect(page.getByTestId('nav-blog')).not.toHaveAttribute(
      'href',
      '/es/articulos',
    );
  });

  test('navigates to correct prefixed URL', async ({ page }) => {
    // Switch to Spanish first
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Click About link
    await page.getByTestId('nav-about').click();

    // Should navigate to prefixed path (not translated)
    await expect(page).toHaveURL(/\/es\/about$/);
    await expect(page.getByTestId('about-page')).toBeVisible();
  });

  test('content is translated even without path translation', async ({
    page,
  }) => {
    // Switch to Spanish
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Content should be in Spanish
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );

    // Navigate to About
    await page.getByTestId('nav-about').click();

    // URL uses English path, but content is Spanish
    await expect(page).toHaveURL(/\/es\/about$/);
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });
});
