import { describe, expect, it, vi } from 'vitest';
import { loadConfig, type IdiomaConfig } from '../cli/config';
import { extractAndMergeFile } from './incremental-extract';
import idiomaVitePlugin, { type IdiomaViteOptions } from './vite';

// Mock ensureGitignore
vi.mock('../utils/gitignore', () => ({
  ensureGitignore: vi.fn().mockResolvedValue(undefined),
}));

// Mocks for driving buildStart and handleHotUpdate in dev mode
vi.mock('../cli/config', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../compiler/compile', () => ({
  createCompileLock: () => ({ compile: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('./incremental-extract', () => ({
  extractAndMergeFile: vi
    .fn()
    .mockResolvedValue({ added: 0, updated: 0, removed: 0 }),
}));

vi.mock('./import-detect', () => ({
  fileImportsIdioma: () => true,
}));

describe('Idioma Vite Plugin', () => {
  it('creates a plugin with correct name', () => {
    const plugin = idiomaVitePlugin({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });

    expect(plugin.name).toBe('idioma');
  });

  it('returns plugin object with expected hooks', () => {
    const plugin = idiomaVitePlugin({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });

    expect(plugin).toHaveProperty('name');
    expect(plugin).toHaveProperty('configResolved');
    expect(plugin).toHaveProperty('buildStart');
  });

  it('accepts all configuration options', () => {
    const options: IdiomaViteOptions = {
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
      watch: true,
    };

    const plugin = idiomaVitePlugin(options);

    expect(plugin.name).toBe('idioma');
  });

  it('has enforce: pre for early processing', () => {
    const plugin = idiomaVitePlugin({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });

    expect(plugin.enforce).toBe('pre');
  });

  it('exposes an async handleHotUpdate so it can await Vite read()', () => {
    // Regression guard: the source-file short-circuit reads file content via
    // Vite's HmrContext.read(), which is async. If handleHotUpdate is ever
    // made sync again, the await would silently turn into Promise<true> and
    // every file would pass the import check.
    const plugin = idiomaVitePlugin({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });

    expect(plugin.handleHotUpdate).toBeTypeOf('function');
    expect(plugin.handleHotUpdate?.constructor.name).toBe('AsyncFunction');
  });

  describe('dev-mode extraction', () => {
    async function saveSourceFile(options?: IdiomaViteOptions) {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const plugin = idiomaVitePlugin(options) as any;
      plugin.configResolved({ command: 'serve', root: '/project' });
      await plugin.buildStart.call({});
      await plugin.handleHotUpdate({
        file: '/project/src/App.tsx',
        read: async () => '',
        server: {},
      });
    }

    it('passes po options from idioma.config.ts to extraction', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
        po: { foldLength: 0 },
      } as IdiomaConfig);

      await saveSourceFile();

      await vi.waitFor(() =>
        expect(extractAndMergeFile).toHaveBeenCalledWith(
          expect.objectContaining({ po: { foldLength: 0 } }),
        ),
      );
    });

    it('lets plugin options override po from idioma.config.ts', async () => {
      vi.mocked(extractAndMergeFile).mockClear();
      vi.mocked(loadConfig).mockResolvedValue({
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
        po: { foldLength: 0 },
      } as IdiomaConfig);

      await saveSourceFile({ po: { foldLength: 120 } });

      await vi.waitFor(() =>
        expect(extractAndMergeFile).toHaveBeenCalledWith(
          expect.objectContaining({ po: { foldLength: 120 } }),
        ),
      );
    });
  });
});
