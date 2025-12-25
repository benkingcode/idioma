import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { compileTranslations } from '../compiler/compile';
import { withIdioma, type IdiomaMetroOptions } from './metro';

// Mock compileTranslations
vi.mock('../compiler/compile', () => ({
  compileTranslations: vi.fn().mockResolvedValue(undefined),
}));

// Mock ensureGitignore
vi.mock('../utils/gitignore', () => ({
  ensureGitignore: vi.fn().mockResolvedValue(undefined),
}));

// Mock chokidar
const mockWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn(),
};

vi.mock('chokidar', () => ({
  watch: vi.fn(() => mockWatcher),
}));

// Mock fs.promises.utimes for touch
vi.mock('fs/promises', () => ({
  utimes: vi.fn().mockResolvedValue(undefined),
}));

const mockCompileTranslations = compileTranslations as Mock;

describe('withIdioma', () => {
  const defaultOptions: IdiomaMetroOptions = {
    idiomaDir: './src/idioma',
    defaultLocale: 'en',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWatcher.on.mockReturnThis();
  });

  it('returns a function', () => {
    const wrapper = withIdioma(defaultOptions);
    expect(typeof wrapper).toBe('function');
  });

  it('returned function returns a promise', () => {
    const wrapper = withIdioma(defaultOptions);
    const result = wrapper({ projectRoot: '/test' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('compiles translations on config creation', async () => {
    const wrapper = withIdioma(defaultOptions);
    await wrapper({ projectRoot: '/test' });

    expect(mockCompileTranslations).toHaveBeenCalledWith({
      localeDir: '/test/src/idioma/locales',
      outputDir: '/test/src/idioma',
      defaultLocale: 'en',
      locales: undefined,
      useSuspense: undefined,
      projectRoot: '/test',
    });
  });

  it('adds outputDir to watchFolders', async () => {
    const wrapper = withIdioma(defaultOptions);
    const config = await wrapper({ projectRoot: '/test' });

    expect(config.watchFolders).toContain('/test/src/idioma');
  });

  it('preserves existing watchFolders', async () => {
    const wrapper = withIdioma(defaultOptions);
    const config = await wrapper({
      projectRoot: '/test',
      watchFolders: ['/existing/folder'],
    });

    expect(config.watchFolders).toContain('/existing/folder');
    expect(config.watchFolders).toContain('/test/src/idioma');
  });

  it('preserves other Metro config properties', async () => {
    const wrapper = withIdioma(defaultOptions);
    const config = await wrapper({
      projectRoot: '/test',
      resetCache: true,
    });

    expect(config.resetCache).toBe(true);
  });

  it('uses process.cwd() when projectRoot is not provided', async () => {
    const wrapper = withIdioma(defaultOptions);
    await wrapper({});

    expect(mockCompileTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: process.cwd(),
      }),
    );
  });

  it('accepts all configuration options', async () => {
    const options: IdiomaMetroOptions = {
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
      watch: false,
      useSuspense: true,
    };

    const wrapper = withIdioma(options);
    await wrapper({ projectRoot: '/test' });

    expect(mockCompileTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        locales: ['en', 'es', 'fr'],
        useSuspense: true,
      }),
    );
  });
});

describe('Metro watcher', () => {
  const defaultOptions: IdiomaMetroOptions = {
    idiomaDir: './src/idioma',
    defaultLocale: 'en',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWatcher.on.mockReturnThis();
  });

  afterEach(() => {
    mockWatcher.close.mockClear();
  });

  it('sets up file watcher when watch is enabled (default)', async () => {
    const { watch } = await import('chokidar');

    const wrapper = withIdioma(defaultOptions);
    await wrapper({ projectRoot: '/test' });

    expect(watch).toHaveBeenCalledWith(
      '/test/src/idioma/locales/**/*.po',
      expect.objectContaining({
        ignoreInitial: true,
      }),
    );
  });

  it('does not set up file watcher when watch is false', async () => {
    const { watch } = await import('chokidar');
    (watch as Mock).mockClear();

    const wrapper = withIdioma({ ...defaultOptions, watch: false });
    await wrapper({ projectRoot: '/test' });

    expect(watch).not.toHaveBeenCalled();
  });

  it('registers change and add event handlers', async () => {
    const wrapper = withIdioma(defaultOptions);
    await wrapper({ projectRoot: '/test' });

    const onCalls = mockWatcher.on.mock.calls.map(([event]) => event);
    expect(onCalls).toContain('change');
    expect(onCalls).toContain('add');
  });

  it('recompiles when PO files change', async () => {
    const wrapper = withIdioma(defaultOptions);
    await wrapper({ projectRoot: '/test' });

    // Get the 'change' handler
    const changeCall = mockWatcher.on.mock.calls.find(
      ([event]) => event === 'change',
    );
    expect(changeCall).toBeDefined();
    const changeHandler = changeCall![1];

    // Clear mock to track recompilation
    mockCompileTranslations.mockClear();

    // Simulate file change
    await changeHandler('/test/src/idioma/locales/es.po');

    expect(mockCompileTranslations).toHaveBeenCalled();
  });

  it('recompiles when PO files are added', async () => {
    const wrapper = withIdioma(defaultOptions);
    await wrapper({ projectRoot: '/test' });

    // Get the 'add' handler
    const addCall = mockWatcher.on.mock.calls.find(
      ([event]) => event === 'add',
    );
    expect(addCall).toBeDefined();
    const addHandler = addCall![1];

    // Clear mock to track recompilation
    mockCompileTranslations.mockClear();

    // Simulate file add
    await addHandler('/test/src/idioma/locales/fr.po');

    expect(mockCompileTranslations).toHaveBeenCalled();
  });

  it('touches output file after recompilation to trigger Metro refresh', async () => {
    const { utimes } = await import('fs/promises');

    const wrapper = withIdioma(defaultOptions);
    await wrapper({ projectRoot: '/test' });

    // Get the 'change' handler and trigger it
    const changeCall = mockWatcher.on.mock.calls.find(
      ([event]) => event === 'change',
    );
    const changeHandler = changeCall![1];

    await changeHandler('/test/src/idioma/locales/es.po');

    expect(utimes).toHaveBeenCalledWith(
      '/test/src/idioma/index.ts',
      expect.any(Date),
      expect.any(Date),
    );
  });
});

describe('error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWatcher.on.mockReturnThis();
  });

  it('logs error when compilation fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCompileTranslations.mockRejectedValueOnce(new Error('Compile failed'));

    const wrapper = withIdioma({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });

    await wrapper({ projectRoot: '/test' });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[idioma] Compilation error:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('handles touch failure gracefully', async () => {
    const { utimes } = await import('fs/promises');
    (utimes as Mock).mockRejectedValueOnce(new Error('File not found'));

    const wrapper = withIdioma({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });
    await wrapper({ projectRoot: '/test' });

    // Get the 'change' handler and trigger it
    const changeCall = mockWatcher.on.mock.calls.find(
      ([event]) => event === 'change',
    );
    const changeHandler = changeCall![1];

    // Should not throw
    await expect(
      changeHandler('/test/src/idioma/locales/es.po'),
    ).resolves.not.toThrow();
  });
});
