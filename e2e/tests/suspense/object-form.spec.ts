import { expect, test } from '@playwright/test';

/**
 * In suspense mode, t() calls are a graceful fallback — __useTSuspense
 * returns a function that echoes back the source text (it can't suspend
 * like <Trans> does). These tests verify the object form normalizes
 * correctly so the fallback returns the expected source text.
 */
test.describe('Suspense Mode - useT Object Form (fallback behavior)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders source text for t({ id, source })', async ({ page }) => {
    await expect(page.getByTestId('uset-obj-with-source')).toContainText(
      'Hello from object form!',
    );
  });

  test('renders interpolated source for t({ id, source, values })', async ({
    page,
  }) => {
    await expect(page.getByTestId('uset-obj-with-values')).toContainText(
      'Welcome, Tester!',
    );
  });

  test('renders id as fallback for t({ id }) without source', async ({
    page,
  }) => {
    // In suspense mode, t() falls back to source text.
    // When no source is provided, the id is used as fallback.
    await expect(page.getByTestId('uset-obj-id-only')).toContainText(
      'uset.idOnly',
    );
  });
});
