import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { expect, test } from '@playwright/test';
import { selectLocale } from '../../utils/test-helpers';

/**
 * A PO edit in dev mode used to invalidate every module and reload the page,
 * so state was lost on every translation change. Now it hot-updates only
 * the modules that use the edited message, and Fast Refresh keeps state.
 *
 * The locale is page state (the fixture keeps it in useState), so a full
 * reload would also put the page back in English.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
// A namespace file, which the no-op edit spec (running alongside) doesn't watch
const ES_PO = join(
  __dirname,
  '../../fixtures/standard/src/idioma/locales/es/hot.po',
);
const ORIGINAL = 'msgstr "Mensaje en caliente"';
const EDITED = 'msgstr "Mensaje en caliente, editado"';

test.describe('Dev mode - PO edit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(30000);

  test('updates the message in place, without a reload', async ({ page }) => {
    await page.goto('/');
    await selectLocale(page, 'es');
    await expect(page.getByTestId('hot-message')).toHaveText(
      'Mensaje en caliente',
    );

    // A full reload clears this; a hot update keeps it
    await page.evaluate(() => {
      (window as unknown as { __idiomaMarker: number }).__idiomaMarker = 1;
    });

    const original = await fs.readFile(ES_PO, 'utf-8');
    expect(original).toContain(ORIGINAL);

    try {
      await fs.writeFile(ES_PO, original.replace(ORIGINAL, EDITED));

      await expect(page.getByTestId('hot-message')).toHaveText(
        'Mensaje en caliente, editado',
        { timeout: 10000 },
      );
      await expect(page.getByTestId('current-locale')).toHaveText('es');
      const marker = await page.evaluate(
        () => (window as unknown as { __idiomaMarker?: number }).__idiomaMarker,
      );
      expect(marker, 'page was fully reloaded').toBe(1);
    } finally {
      await fs.writeFile(ES_PO, original);
      await expect(page.getByTestId('hot-message')).toHaveText(
        /Mensaje en caliente|Hot message/,
        { timeout: 10000 },
      );
    }
  });
});
