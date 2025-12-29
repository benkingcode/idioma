import { expect, test } from '@playwright/test';

test.describe('Translation Content', () => {
  test.describe('English Content', () => {
    test('home page shows English content', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('home-title')).toContainText(
        'Welcome to our website',
      );
    });

    test('about page shows English content', async ({ page }) => {
      await page.goto('/about');

      await expect(page.getByTestId('about-title')).toContainText(
        'About our company',
      );
      await expect(page.getByTestId('about-description')).toContainText(
        'Learn more about what we do',
      );
    });

    test('blog page shows English content', async ({ page }) => {
      await page.goto('/blog');

      await expect(page.getByTestId('blog-title')).toContainText('Our Blog');
      await expect(page.getByTestId('blog-description')).toContainText(
        'Read our latest articles',
      );
    });

    test('contact page shows English content', async ({ page }) => {
      await page.goto('/contact');

      await expect(page.getByTestId('contact-title')).toContainText(
        'Get in touch',
      );
    });
  });

  test.describe('Spanish Content', () => {
    test('home page shows Spanish content', async ({ page }) => {
      await page.goto('/es');

      await expect(page.getByTestId('home-title')).toContainText(
        'Bienvenido a nuestro sitio web',
      );
    });

    test('about page shows Spanish content', async ({ page }) => {
      await page.goto('/es');
      await page.getByTestId('nav-about').click();

      await expect(page.getByTestId('about-title')).toContainText(
        'Acerca de nuestra empresa',
      );
      await expect(page.getByTestId('about-description')).toContainText(
        'Conoce mas sobre lo que hacemos',
      );
    });

    test('blog page shows Spanish content', async ({ page }) => {
      await page.goto('/es');
      await page.getByTestId('nav-blog').click();

      await expect(page.getByTestId('blog-title')).toContainText(
        'Nuestro Blog',
      );
    });

    test('contact page shows Spanish content', async ({ page }) => {
      await page.goto('/es');
      await page.getByTestId('nav-contact').click();

      await expect(page.getByTestId('contact-title')).toContainText(
        'Contactanos',
      );
    });
  });

  test.describe('Content Updates on Locale Switch', () => {
    test('content updates immediately when switching to Spanish', async ({
      page,
    }) => {
      await page.goto('/');

      // Verify English
      await expect(page.getByTestId('home-title')).toContainText('Welcome');

      // Switch to Spanish
      await page.getByTestId('locale-es').click();
      await page.waitForURL(/\/es/);

      // Content should be Spanish immediately (no flash of English)
      await expect(page.getByTestId('home-title')).toContainText('Bienvenido');
    });

    test('content updates immediately when switching to English', async ({
      page,
    }) => {
      await page.goto('/es');

      // Verify Spanish
      await expect(page.getByTestId('home-title')).toContainText('Bienvenido');

      // Switch to English
      await page.getByTestId('locale-en').click();
      await page.waitForURL(/^http:\/\/localhost:\d+\/$/);

      // Content should be English immediately
      await expect(page.getByTestId('home-title')).toContainText('Welcome');
    });
  });
});
