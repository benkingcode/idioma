import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { watch, type FSWatcher } from 'chokidar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSourceWatchIgnore, ignoreNonPoFiles } from './metro';

/**
 * The Metro plugin's watchers, against real chokidar on a real folder:
 * chokidar 4 dropped globs, so the plugin watches folders and filters with
 * `ignored`, which must skip other files but never a folder it must walk.
 */
describe('Metro watcher filters, with real chokidar', () => {
  let root: string;
  let watcher: FSWatcher | undefined;

  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'idioma-watch-')));
    await fs.mkdir(join(root, 'src/idioma/locales/es'), { recursive: true });
    await fs.mkdir(join(root, 'node_modules/lib'), { recursive: true });
  });

  afterEach(async () => {
    await watcher?.close();
    watcher = undefined;
    await fs.rm(root, { recursive: true, force: true });
  });

  /**
   * The files chokidar reports for `write`. Waits until every expected
   * file is reported (a loaded machine is slow to report), then a little
   * longer, so an event that should not happen has time to show up.
   */
  async function events(
    dir: string,
    ignored: (path: string, stats?: import('fs').Stats) => boolean,
    write: () => Promise<void>,
    expected: string[],
  ): Promise<string[]> {
    const seen = new Set<string>();
    watcher = watch(dir, { ignoreInitial: true, ignored });
    await new Promise<void>((done) => watcher!.on('ready', () => done()));
    const record = (path: string) => seen.add(path.slice(root.length + 1));
    watcher.on('add', record);
    watcher.on('change', record);
    await write();
    await vi.waitFor(
      () =>
        expect([...seen].filter((p) => expected.includes(p))).toHaveLength(
          expected.length,
        ),
      { timeout: 5000, interval: 50 },
    );
    await new Promise((done) => setTimeout(done, 400));
    return [...seen].sort();
  }

  it('sees PO files, nested ones included, and nothing else', async () => {
    const locales = join(root, 'src/idioma/locales');
    const expectedPo = [
      'src/idioma/locales/es.po',
      'src/idioma/locales/es/marketing.po',
    ];
    const seen = await events(
      locales,
      ignoreNonPoFiles,
      async () => {
        await fs.writeFile(join(locales, 'es.po'), 'msgid ""\n');
        await fs.writeFile(join(locales, 'es/marketing.po'), 'msgid ""\n');
        await fs.writeFile(join(locales, 'notes.txt'), 'x');
      },
      expectedPo,
    );
    expect(seen).toEqual(expectedPo);
  });

  it('sees source files, and skips ignored folders and other files', async () => {
    const seen = await events(
      root,
      createSourceWatchIgnore(root),
      async () => {
        await fs.writeFile(join(root, 'src/App.tsx'), 'export {};\n');
        await fs.writeFile(join(root, 'src/util.ts'), 'export {};\n');
        await fs.writeFile(join(root, 'node_modules/lib/index.js'), '');
        await fs.writeFile(join(root, 'README.md'), '#');
      },
      ['src/App.tsx', 'src/util.ts'],
    );
    expect(seen).toEqual(['src/App.tsx', 'src/util.ts']);
  });
});
