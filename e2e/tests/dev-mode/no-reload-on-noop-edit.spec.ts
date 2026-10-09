import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { expect, test } from '@playwright/test';

/**
 * Issue #9: in dev mode, saving a source file that uses Idioma rewrote every
 * locale .po file, even when no message changed. Each .po write fires the
 * Vite plugin's .po handler, which sends a full page reload, so page state
 * was lost on every save.
 *
 * This edits a component without changing its messages and checks that the
 * page is not reloaded and the .po files are not written.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '../../fixtures/standard');
const COMPONENT = join(FIXTURE_DIR, 'src/components/BasicTrans.tsx');
const PO_FILES = ['en', 'es', 'ar'].map((locale) =>
  join(FIXTURE_DIR, `src/idioma/locales/${locale}.po`),
);

// Debounce (200ms) + extraction + compile, with margin
const SETTLE_MS = 2500;

async function snapshotPoFiles() {
  return Promise.all(
    PO_FILES.map(async (path) => ({
      path,
      content: await fs.readFile(path, 'utf-8'),
      mtimeMs: (await fs.stat(path)).mtimeMs,
    })),
  );
}

test.describe('Dev mode - no-op source edit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(20000);

  test('does not rewrite .po files or reload the page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('basic-hello')).toContainText(
      'Hello, World!',
    );

    // A full reload clears this; Fast Refresh keeps it
    await page.evaluate(() => {
      (window as unknown as { __idiomaMarker: number }).__idiomaMarker = 1;
    });

    const before = await snapshotPoFiles();
    const original = await fs.readFile(COMPONENT, 'utf-8');

    try {
      await fs.writeFile(COMPONENT, `${original}// e2e no-op edit\n`);
      await page.waitForTimeout(SETTLE_MS);

      const marker = await page.evaluate(
        () => (window as unknown as { __idiomaMarker?: number }).__idiomaMarker,
      );
      expect(marker, 'page was fully reloaded').toBe(1);

      const after = await snapshotPoFiles();
      for (const [i, file] of after.entries()) {
        expect(file.content, `${file.path} content`).toBe(before[i]!.content);
        expect(file.mtimeMs, `${file.path} mtime`).toBe(before[i]!.mtimeMs);
      }
    } finally {
      await fs.writeFile(COMPONENT, original);
    }
  });
});
