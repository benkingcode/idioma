import { expect, Page } from '@playwright/test';

/**
 * Select a locale from the locale switcher dropdown
 */
export async function selectLocale(page: Page, locale: string): Promise<void> {
  await page.getByTestId('locale-selector').selectOption(locale);
  await expect(page.getByTestId('current-locale')).toHaveText(locale);
}

/**
 * Get the text content of an element by test ID
 */
export async function getTextContent(
  page: Page,
  testId: string,
): Promise<string> {
  const element = page.getByTestId(testId);
  return (await element.textContent()) ?? '';
}

/**
 * Click an element by test ID multiple times
 */
export async function clickNTimes(
  page: Page,
  testId: string,
  n: number,
): Promise<void> {
  for (let i = 0; i < n; i++) {
    await page.getByTestId(testId).click();
  }
}

/**
 * Wait for translations to be loaded (useful for Suspense mode)
 */
export async function waitForTranslationsLoaded(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Set a counter to a specific value using increment/decrement buttons
 */
export async function setCounterValue(
  page: Page,
  incrementTestId: string,
  decrementTestId: string,
  countTestId: string,
  targetValue: number,
): Promise<void> {
  const currentText = await page.getByTestId(countTestId).textContent();
  const currentValue = parseInt(currentText ?? '0', 10);

  if (targetValue > currentValue) {
    await clickNTimes(page, incrementTestId, targetValue - currentValue);
  } else if (targetValue < currentValue) {
    await clickNTimes(page, decrementTestId, currentValue - targetValue);
  }

  await expect(page.getByTestId(countTestId)).toHaveText(String(targetValue));
}
