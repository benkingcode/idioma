import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractAndMergeFile } from './incremental-extract';

// Uses the real file system, unlike incremental-extract.test.ts, which mocks
// fs and the PO parser. These tests check the bytes that end up on disk.

const LONG_SOURCE =
  "Downloading activates this ticket. Once activated, it can't be transferred to anyone else.";
const LONG_ES =
  'Al descargarla se activa esta entrada. Una vez activada, no se puede transferir a nadie más.';

function poFile(locale: string, references: string[], msgstr: string): string {
  return `msgid ""
msgstr ""
"Language: ${locale}\\n"

${references.map((ref) => `#: ${ref}`).join('\n')}
#, extracted
msgid "tickets.confirm"
msgstr "${msgstr}"
`;
}

function component(name: string): string {
  return `import { Trans } from './idioma';

export function ${name}() {
  return <Trans id="tickets.confirm">${LONG_SOURCE}</Trans>;
}
`;
}

describe('extractAndMergeFile (real file system)', () => {
  let projectRoot: string;
  let localeDir: string;
  const past = new Date('2020-01-01T00:00:00Z');

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(join(tmpdir(), 'idioma-incremental-'));
    localeDir = join(projectRoot, 'src/idioma/locales');
    await fs.mkdir(localeDir, { recursive: true });
    await fs.writeFile(join(projectRoot, 'src/idioma/index.ts'), '');
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  async function writeCatalogs(references: string[]) {
    const files = {
      en: poFile('en', references, LONG_SOURCE),
      es: poFile('es', references, LONG_ES),
    };
    for (const [locale, content] of Object.entries(files)) {
      const path = join(localeDir, `${locale}.po`);
      await fs.writeFile(path, content, 'utf-8');
      await fs.utimes(path, past, past);
    }
    return files;
  }

  async function extract(relativePath: string) {
    return extractAndMergeFile({
      filePath: join(projectRoot, relativePath),
      projectRoot,
      idiomaDir: join(projectRoot, 'src/idioma'),
      localeDir,
      defaultLocale: 'en',
      locales: ['en', 'es'],
    });
  }

  async function expectUntouched(files: Record<string, string>) {
    for (const [locale, content] of Object.entries(files)) {
      const path = join(localeDir, `${locale}.po`);
      expect(await fs.readFile(path, 'utf-8')).toBe(content);
      expect((await fs.stat(path)).mtimeMs).toBe(past.getTime());
    }
  }

  it('leaves PO files untouched when a save changes no message', async () => {
    // Issue #9: an unfolded msgstr longer than 76 columns was re-folded on
    // every save, and every locale file was rewritten.
    await fs.writeFile(
      join(projectRoot, 'src/Tickets.tsx'),
      component('Tickets'),
    );
    const files = await writeCatalogs(['src/Tickets.tsx']);

    await extract('src/Tickets.tsx');

    await expectUntouched(files);
  });
});
