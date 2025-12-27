import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureExtracted } from './ensure-extracted';

describe('ensureExtracted', () => {
  let tempDir: string;
  let localeDir: string;
  let srcDir: string;
  let idiomaDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-ensure-extracted-'));
    localeDir = join(tempDir, 'src', 'idioma', 'locales');
    srcDir = join(tempDir, 'src');
    idiomaDir = join(tempDir, 'src', 'idioma');
    await fs.mkdir(localeDir, { recursive: true });
    await fs.mkdir(srcDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns extracted: false when all PO files exist', async () => {
    // Create existing PO files
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );
    await fs.writeFile(
      join(localeDir, 'es.po'),
      `
msgid ""
msgstr ""
"Language: es\\n"

msgid "h001"
msgstr ""
`,
    );

    const result = await ensureExtracted({
      localeDir,
      locales: ['en', 'es'],
      cwd: tempDir,
      config: {
        idiomaDir: 'src/idioma',
        defaultLocale: 'en',
        locales: ['en', 'es'],
      },
    });

    expect(result.extracted).toBe(false);
    expect(result.messages).toBeUndefined();
    expect(result.files).toBeUndefined();
  });

  it('runs extract when default locale PO file is missing', async () => {
    // Create source file for extraction
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `import { Trans } from './idioma'
export const App = () => <Trans>Hello</Trans>`,
    );

    // Create idioma index file so imports resolve
    await fs.writeFile(
      join(idiomaDir, 'index.ts'),
      `export { Trans } from '@idioma/react'`,
    );

    // No PO files exist
    const result = await ensureExtracted({
      localeDir,
      locales: ['en', 'es'],
      cwd: tempDir,
      config: {
        idiomaDir: 'src/idioma',
        defaultLocale: 'en',
        locales: ['en', 'es'],
      },
    });

    expect(result.extracted).toBe(true);
    expect(result.messages).toBeGreaterThanOrEqual(0);
    expect(result.files).toBeGreaterThanOrEqual(0);

    // Verify PO files were created
    const enExists = await fs
      .access(join(localeDir, 'en.po'))
      .then(() => true)
      .catch(() => false);
    const esExists = await fs
      .access(join(localeDir, 'es.po'))
      .then(() => true)
      .catch(() => false);
    expect(enExists).toBe(true);
    expect(esExists).toBe(true);
  });

  it('runs extract when target locale PO file is missing', async () => {
    // Default locale exists, but target doesn't
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"

msgid "h001"
msgstr "Hello"
`,
    );

    // Create source file for extraction
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `import { Trans } from './idioma'
export const App = () => <Trans>Hello</Trans>`,
    );

    await fs.writeFile(
      join(idiomaDir, 'index.ts'),
      `export { Trans } from '@idioma/react'`,
    );

    const result = await ensureExtracted({
      localeDir,
      locales: ['en', 'es'],
      cwd: tempDir,
      config: {
        idiomaDir: 'src/idioma',
        defaultLocale: 'en',
        locales: ['en', 'es'],
      },
    });

    expect(result.extracted).toBe(true);

    // es.po should now exist
    const esExists = await fs
      .access(join(localeDir, 'es.po'))
      .then(() => true)
      .catch(() => false);
    expect(esExists).toBe(true);
  });

  it('calls onExtractStart and onExtractComplete callbacks', async () => {
    // Create source file
    await fs.writeFile(
      join(srcDir, 'App.tsx'),
      `import { Trans } from './idioma'
export const App = () => <Trans>Hello</Trans>`,
    );

    await fs.writeFile(
      join(idiomaDir, 'index.ts'),
      `export { Trans } from '@idioma/react'`,
    );

    // No PO files exist
    const onExtractStart = vi.fn();
    const onExtractComplete = vi.fn();

    await ensureExtracted({
      localeDir,
      locales: ['en'],
      cwd: tempDir,
      config: {
        idiomaDir: 'src/idioma',
        defaultLocale: 'en',
        locales: ['en'],
      },
      onExtractStart,
      onExtractComplete,
    });

    expect(onExtractStart).toHaveBeenCalledTimes(1);
    expect(onExtractComplete).toHaveBeenCalledTimes(1);
    expect(onExtractComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.any(Number),
        files: expect.any(Number),
      }),
    );
  });

  it('does not call callbacks when no extraction needed', async () => {
    // Create existing PO file
    await fs.writeFile(
      join(localeDir, 'en.po'),
      `
msgid ""
msgstr ""
"Language: en\\n"
`,
    );

    const onExtractStart = vi.fn();
    const onExtractComplete = vi.fn();

    await ensureExtracted({
      localeDir,
      locales: ['en'],
      cwd: tempDir,
      config: {
        idiomaDir: 'src/idioma',
        defaultLocale: 'en',
        locales: ['en'],
      },
      onExtractStart,
      onExtractComplete,
    });

    expect(onExtractStart).not.toHaveBeenCalled();
    expect(onExtractComplete).not.toHaveBeenCalled();
  });
});
