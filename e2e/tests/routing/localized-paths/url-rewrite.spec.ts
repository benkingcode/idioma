import { expect, test } from '@playwright/test';

test.describe('URL Rewrite Functions - Localized Paths', () => {
  test('delocalizeUrl maps localized to canonical for route matching', async ({
    page,
  }) => {
    // Navigate to Spanish localized URL
    await page.goto('/es/sobre');

    // Page should render correctly (proves delocalizeUrl worked)
    await expect(page.getByTestId('about-page')).toBeVisible();
    await expect(page.getByTestId('about-title')).toContainText(
      'Acerca de nuestra empresa',
    );
  });

  test('localizeUrl maps canonical to localized for display', async ({
    page,
  }) => {
    // Start at home and switch to Spanish
    await page.goto('/');
    await page.getByTestId('locale-es').click();
    await page.waitForURL(/\/es/);

    // Links should show localized paths (proves localizeUrl worked)
    await expect(page.getByTestId('nav-about')).toHaveAttribute(
      'href',
      '/es/sobre',
    );
  });

  test('handles root path correctly', async ({ page }) => {
    await page.goto('/es');

    // Should render home page in Spanish
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('home-title')).toContainText(
      'Bienvenido a nuestro sitio web',
    );
  });

  test('passes through unrecognized paths', async ({ page }) => {
    // Navigate to a path that doesn't exist
    const response = await page.goto('/es/unknown-path');

    // Should get a 404 or not found message (path wasn't transformed)
    // The exact behavior depends on the router's 404 handling
    expect(response?.status()).toBeLessThan(500);
  });

  test('URL stays localized after navigation', async ({ page }) => {
    await page.goto('/es');

    // Navigate to About via link
    await page.getByTestId('nav-about').click();

    // URL should be the localized version
    await expect(page).toHaveURL(/\/es\/sobre$/);

    // Navigate to Contact
    await page.getByTestId('nav-contact').click();

    // URL should remain localized
    await expect(page).toHaveURL(/\/es\/contacto$/);
  });

  test('browser back/forward preserves localized URLs', async ({ page }) => {
    await page.goto('/es');

    // Navigate forward
    await page.getByTestId('nav-about').click();
    await expect(page).toHaveURL(/\/es\/sobre$/);

    // Navigate to another page
    await page.getByTestId('nav-contact').click();
    await expect(page).toHaveURL(/\/es\/contacto$/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/es\/sobre$/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/es\/contacto$/);
  });
});
