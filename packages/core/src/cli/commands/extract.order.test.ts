import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPoFile } from '../../po/parser';
import { extractMessages } from './extract';

// Issue #12. fast-glob does not promise a stable order, and extract used to
// add references in the order it returned files. A key used in two files then
// got its #: lines in a different order from run to run, so a no-op extract
// rewrote the catalogues. This mock returns files in reverse path order,
// which is one of the orders fast-glob can return.
vi.mock('fast-glob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fast-glob')>();
  const realGlob = actual.default;
  const reversedGlob = async (...args: Parameters<typeof realGlob>) =>
    (await realGlob(...args)).sort().reverse();
  return { ...actual, default: Object.assign(reversedGlob, realGlob) };
});

describe('extract reference order', () => {
  let tempDir: string;
  let srcDir: string;
  let idiomaDir: string;
  let localeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-extract-order-'));
    srcDir = join(tempDir, 'src');
    idiomaDir = join(srcDir, 'idioma');
    localeDir = join(tempDir, 'locales');
    await fs.mkdir(idiomaDir, { recursive: true });
    await fs.mkdir(localeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes references in path order, whatever order fast-glob returns', async () => {
    for (const name of ['A', 'B']) {
      await fs.writeFile(
        join(srcDir, `${name}.tsx`),
        `
        import { Trans } from './idioma'
        export const ${name} = () => <Trans id="shared.key">Shared</Trans>
        `,
      );
    }

    await extractMessages({
      cwd: tempDir,
      sourcePatterns: ['src/**/*.tsx'],
      localeDir,
      defaultLocale: 'en',
      idiomaDir,
    });

    const catalog = await loadPoFile(join(localeDir, 'en.po'), 'en');
    expect(catalog.messages.get('shared.key')?.references).toEqual([
      'src/A.tsx',
      'src/B.tsx',
    ]);
  });
});
