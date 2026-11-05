import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { build } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import idioma from '../../src/bundler/vite';

/**
 * A real `vite build` with the plugin, in a root that is not the working
 * directory.
 */
describe('vite build with the Idioma plugin', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'idioma-vite-build-'));
    await fs.mkdir(join(root, 'src/idioma/locales'), { recursive: true });
    await fs.writeFile(
      join(root, 'idioma.config.ts'),
      `export default { idiomaDir: './src/idioma', defaultLocale: 'en', locales: ['en'] };\n`,
    );
    await fs.writeFile(
      join(root, 'index.html'),
      '<!doctype html><script type="module" src="/src/main.ts"></script>\n',
    );
    await fs.writeFile(join(root, 'src/main.ts'), "console.log('ok');\n");
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  function viteBuild() {
    return build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [idioma()],
      build: { outDir: join(root, 'dist'), write: false },
    });
  }

  it('builds when the catalogue compiles', async () => {
    await fs.writeFile(
      join(root, 'src/idioma/locales/en.po'),
      'msgid ""\nmsgstr ""\n"Language: en\\n"\n\nmsgid "a.b"\nmsgstr "Hello"\n',
    );

    await expect(viteBuild()).resolves.toBeDefined();

    // The catalogue compiles under Vite's root, not the working directory
    await expect(
      fs.access(join(root, 'src/idioma/.generated/translations.js')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(join(root, 'src/idioma/.gitignore')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(join(process.cwd(), 'src/idioma')),
    ).rejects.toThrow();
  });
});
