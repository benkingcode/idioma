import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const compileMock = vi.hoisted(() => vi.fn());

vi.mock('../compiler/compile', () => ({
  createCompileLock: () => ({ compile: compileMock }),
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
  beforeEach(() => {
    compileMock.mockReset();
    compileMock.mockResolvedValue(undefined);
  });

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

  describe('transform', () => {
    // A plugin past buildStart, in build mode, with the given config
    async function startedPlugin() {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(loadConfig).mockResolvedValue({
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
      } as IdiomaConfig);
      const plugin = idiomaVitePlugin() as any;
      plugin.configResolved({ command: 'build', root: '/project' });
      await plugin.buildStart.call({});
      return plugin;
    }

    const app = `
      import { Trans } from './idioma';
      export const App = () => <Trans id="greeting">Hello</Trans>;
    `;

    it('has no reactBabel hook: it transforms on its own (#20)', () => {
      const plugin = idiomaVitePlugin({ idiomaDir: './src/idioma' }) as any;
      expect(plugin.api?.reactBabel).toBeUndefined();
      expect(plugin.transform.handler).toBeTypeOf('function');
    });

    it("runs before other plugins' transforms, plugin-react 6's compiler included", () => {
      const plugin = idiomaVitePlugin({ idiomaDir: './src/idioma' }) as any;
      expect(plugin.enforce).toBe('pre');
      expect(plugin.transform.order).toBe('pre');
    });

    it('filters out node_modules and non-script files', () => {
      const { filter } = (idiomaVitePlugin() as any).transform;
      const matches = (patterns: RegExp[], value: string) =>
        patterns.some((pattern) => pattern.test(value));
      expect(matches(filter.id.include, '/project/src/App.tsx')).toBe(true);
      expect(matches(filter.id.include, '/project/src/style.css')).toBe(false);
      expect(
        matches(filter.id.exclude, '/project/node_modules/x/index.js'),
      ).toBe(true);
    });

    it('turns <Trans> into <__Trans>, keeping JSX for the next plugin', async () => {
      const plugin = await startedPlugin();
      const result = plugin.transform.handler.call(
        {
          error: (e: unknown) => {
            throw e;
          },
        },
        app,
        '/project/src/App.tsx',
        {},
      );
      expect(result.code).toContain('<__Trans __t={');
      expect(result.code).toContain('import { __Trans } from "@idioma/react"');
      expect(result.map.mappings).not.toBe('');
    });

    it('leaves a module with nothing to transform alone', async () => {
      const plugin = await startedPlugin();
      const result = plugin.transform.handler.call(
        {},
        'export const x = 1;',
        '/project/src/x.ts',
        {},
      );
      expect(result).toBeNull();
    });

    it('reports a call that cannot be inlined at its position', async () => {
      const plugin = await startedPlugin();
      const error = vi.fn((e: unknown) => {
        throw e;
      });
      const code = `
        import { Trans } from './idioma';
        export const App = ({ k }) => <Trans id={k}>Hello</Trans>;
      `;
      expect(() =>
        plugin.transform.handler.call(
          { error },
          code,
          '/project/src/App.tsx',
          {},
        ),
      ).toThrow();
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('<Trans> needs an id'),
          pos: code.indexOf('<Trans id={k}>'),
        }),
      );
    });

    it("edits Rolldown's native MagicString when the app enables it", async () => {
      const { default: MagicString } = await import('magic-string');
      const plugin = await startedPlugin();
      const native = new MagicString(app);
      const result = plugin.transform.handler.call(
        {},
        app,
        '/project/src/App.tsx',
        { magicString: native },
      );
      expect(result.code).toBe(native);
      expect(native.toString()).toContain('<__Trans');
    });
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

    it('extracts a file in a sibling folder whose name starts the same', async () => {
      vi.mocked(extractAndMergeFile).mockClear();
      vi.mocked(loadConfig).mockResolvedValue({
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
      } as IdiomaConfig);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const plugin = idiomaVitePlugin() as any;
      plugin.configResolved({ command: 'serve', root: '/project' });
      await plugin.buildStart.call({});
      await plugin.handleHotUpdate({
        file: '/project/src/idioma-legacy/Banner.tsx',
        read: async () => '',
        server: {},
      });

      await vi.waitFor(() =>
        expect(extractAndMergeFile).toHaveBeenCalledWith(
          expect.objectContaining({
            filePath: '/project/src/idioma-legacy/Banner.tsx',
          }),
        ),
      );
    });

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

  describe('translations that do not compile', () => {
    const config = {
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    } as IdiomaConfig;

    it('fail the production build', async () => {
      vi.mocked(loadConfig).mockResolvedValue(config);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      compileMock.mockRejectedValueOnce(
        new Error('Error parsing PO data: Invalid key name "Hello" at line 6'),
      );
      const plugin = idiomaVitePlugin() as any;
      plugin.configResolved({ command: 'build', root: '/project' });

      await expect(plugin.buildStart.call({})).rejects.toThrow(
        /\[idioma\] Could not compile translations.*Invalid key name/s,
      );
    });

    it('keep the dev server running, and log the error', async () => {
      vi.mocked(loadConfig).mockResolvedValue(config);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      compileMock.mockRejectedValueOnce(new Error('Invalid key name'));
      const plugin = idiomaVitePlugin({ watch: false }) as any;
      plugin.configResolved({ command: 'serve', root: '/project' });

      await expect(plugin.buildStart.call({})).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        '[idioma] Compilation error:',
        expect.any(Error),
      );
    });
  });

  describe('translation hot updates', () => {
    // A PO edit used to invalidate every module and reload the page. Now the
    // plugin compiles, compares the catalogue, and hands Vite only the
    // modules that inline a message that changed, for Fast Refresh.
    type Catalogue = Record<string, Record<string, string>>;
    let root: string;
    let catalogue: Catalogue;

    async function writeCatalogue() {
      const dir = join(root, 'src/idioma/.generated');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        join(dir, 'translations.js'),
        `export const translations = ${JSON.stringify(catalogue)};\n`,
      );
    }

    beforeEach(async () => {
      root = await fs.mkdtemp(join(tmpdir(), 'idioma-hmr-'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      compileMock.mockImplementation(writeCatalogue);
    });

    async function start(initial: Catalogue, options: IdiomaViteOptions = {}) {
      catalogue = initial;
      vi.mocked(loadConfig).mockResolvedValue({
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
      } as IdiomaConfig);
      const plugin = idiomaVitePlugin({ watch: false, ...options }) as any;
      plugin.configResolved({ command: 'serve', root });
      await plugin.buildStart.call({});
      return plugin;
    }

    function transform(plugin: any, name: string, id: string) {
      const code = `import { useT } from './idioma'\nconst t = useT()\nexport const ${name} = t({ id: '${id}' })\n`;
      plugin.transform.handler.call({}, code, join(root, `src/${name}.tsx`));
    }

    function environment(name = 'client') {
      const modules: Record<string, object> = {};
      return {
        name,
        modules,
        hot: { send: vi.fn() },
        moduleGraph: {
          getModulesByFile(file: string) {
            const key = file.slice(join(root, 'src/').length);
            modules[key] ??= { file };
            return new Set([modules[key]]);
          },
        },
      };
    }

    const server = () => ({
      ws: { send: vi.fn() },
      moduleGraph: { invalidateAll: vi.fn() },
    });

    function editPo(plugin: any, env: object, timestamp = 1) {
      return plugin.hotUpdate.handler.call(
        { environment: env },
        {
          type: 'update',
          file: join(root, 'src/idioma/locales/es.po'),
          timestamp,
          modules: [],
          read: async () => '',
          server: server(),
        },
      );
    }

    it('updates only the modules that use a changed message', async () => {
      const plugin = await start({
        'a.title': { en: 'A', es: 'A' },
        'b.title': { en: 'B', es: 'B' },
      });
      transform(plugin, 'A', 'a.title');
      transform(plugin, 'B', 'b.title');
      catalogue = {
        'a.title': { en: 'A', es: 'A2' },
        'b.title': { en: 'B', es: 'B' },
      };
      const env = environment();

      const modules = await editPo(plugin, env);

      expect(modules).toEqual([env.modules['A.tsx']]);
      expect(env.hot.send).not.toHaveBeenCalled();
    });

    it('updates a module whose message was just added', async () => {
      const plugin = await start({});
      transform(plugin, 'A', 'a.new');
      catalogue = { 'a.new': { en: 'New', es: 'Nuevo' } };
      const env = environment();

      expect(await editPo(plugin, env)).toEqual([env.modules['A.tsx']]);
    });

    it('updates nothing when no message changed', async () => {
      // An extraction that only moved a reference, for example
      const plugin = await start({ 'a.title': { en: 'A', es: 'A' } });
      transform(plugin, 'A', 'a.title');
      const env = environment();

      expect(await editPo(plugin, env)).toEqual([]);
      expect(env.hot.send).not.toHaveBeenCalled();
    });

    it('compiles once for the client and SSR environments', async () => {
      const plugin = await start({ 'a.title': { en: 'A', es: 'A' } });
      transform(plugin, 'A', 'a.title');
      catalogue = { 'a.title': { en: 'A', es: 'A2' } };
      compileMock.mockClear();
      const client = environment('client');
      const ssr = environment('ssr');

      const [fromClient, fromSsr] = await Promise.all([
        editPo(plugin, client, 7),
        editPo(plugin, ssr, 7),
      ]);

      expect(compileMock).toHaveBeenCalledTimes(1);
      expect(fromClient).toEqual([client.modules['A.tsx']]);
      expect(fromSsr).toEqual([ssr.modules['A.tsx']]);
    });

    it('still reloads the page in Suspense mode', async () => {
      // Suspense mode does not inline translations into modules
      const plugin = await start({}, { useSuspense: true });
      const env = environment();

      expect(await editPo(plugin, env)).toEqual([]);
      expect(env.hot.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'full-reload' }),
      );
    });

    it('leaves a PO file outside the locales folder alone', async () => {
      const plugin = await start({});
      const env = environment();
      const result = await plugin.hotUpdate.handler.call(
        { environment: env },
        {
          type: 'update',
          file: join(root, 'vendor/other.po'),
          timestamp: 1,
          modules: [],
          read: async () => '',
          server: server(),
        },
      );
      expect(result).toBeUndefined();
    });
  });
});
