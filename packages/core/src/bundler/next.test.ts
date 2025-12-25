import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { compileTranslations } from '../compiler/compile';
import { withIdioma, type IdiomaNextOptions } from './next';

// Mock compileTranslations and ensureGitignore
vi.mock('../compiler/compile', () => ({
  compileTranslations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/gitignore', () => ({
  ensureGitignore: vi.fn().mockResolvedValue(undefined),
}));

const mockCompileTranslations = compileTranslations as Mock;

describe('withIdioma', () => {
  const defaultOptions: IdiomaNextOptions = {
    idiomaDir: './src/idioma',
    defaultLocale: 'en',
  };

  it('returns a function', () => {
    const plugin = withIdioma(defaultOptions);
    expect(typeof plugin).toBe('function');
  });

  it('the returned function accepts a Next.js config and returns a config', () => {
    const plugin = withIdioma(defaultOptions);
    const config = plugin({});
    expect(typeof config).toBe('object');
  });

  it('preserves existing Next.js config properties', () => {
    const plugin = withIdioma(defaultOptions);
    const config = plugin({
      reactStrictMode: true,
      poweredByHeader: false,
    });

    expect(config.reactStrictMode).toBe(true);
    expect(config.poweredByHeader).toBe(false);
  });

  it('adds a webpack function to the config', () => {
    const plugin = withIdioma(defaultOptions);
    const config = plugin({});

    expect(typeof config.webpack).toBe('function');
  });

  it('chains with existing webpack config', () => {
    const existingWebpack = vi.fn((config) => {
      config.customProperty = true;
      return config;
    });

    const plugin = withIdioma(defaultOptions);
    const config = plugin({ webpack: existingWebpack });

    const mockConfig = { plugins: [] };
    const mockContext = {
      dev: true,
      isServer: true,
      webpack: {},
      buildId: 'test',
      dir: '/test',
    };

    const result = config.webpack!(mockConfig as any, mockContext as any);

    expect(existingWebpack).toHaveBeenCalled();
    expect(result.customProperty).toBe(true);
  });

  it('accepts all configuration options', () => {
    const options: IdiomaNextOptions = {
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
      useSuspense: true,
    };

    const plugin = withIdioma(options);
    const config = plugin({});

    expect(config.webpack).toBeDefined();
  });

  describe('webpack plugin', () => {
    it('adds IdiomaWebpackPlugin to plugins array', () => {
      const plugin = withIdioma(defaultOptions);
      const config = plugin({});

      const mockConfig = { plugins: [] as any[] };
      const mockContext = {
        dev: false,
        isServer: true,
        webpack: {},
        buildId: 'test',
        dir: '/test',
      };

      config.webpack!(mockConfig as any, mockContext as any);

      expect(mockConfig.plugins.length).toBeGreaterThan(0);
      expect(mockConfig.plugins[0].constructor.name).toBe(
        'IdiomaWebpackPlugin',
      );
    });

    it('only adds plugin once across multiple webpack calls', () => {
      const plugin = withIdioma(defaultOptions);
      const config = plugin({});

      const mockConfig = { plugins: [] as any[] };
      const mockContext = {
        dev: false,
        isServer: true,
        webpack: {},
        buildId: 'test',
        dir: '/test',
      };

      config.webpack!(mockConfig as any, mockContext as any);
      const firstCount = mockConfig.plugins.length;

      config.webpack!(mockConfig as any, mockContext as any);
      const secondCount = mockConfig.plugins.length;

      expect(secondCount).toBe(firstCount);
    });
  });
});

describe('IdiomaWebpackPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles translations on beforeCompile hook', async () => {
    const plugin = withIdioma({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });
    const config = plugin({});

    const mockConfig = { plugins: [] as any[] };
    const mockContext = {
      dev: false,
      isServer: true,
      webpack: {},
      buildId: 'test',
      dir: '/test',
    };

    config.webpack!(mockConfig as any, mockContext as any);

    const webpackPlugin = mockConfig.plugins[0];

    // Simulate webpack compiler
    const mockCompiler = {
      hooks: {
        beforeCompile: {
          tapAsync: vi.fn(),
        },
        watchRun: {
          tapAsync: vi.fn(),
        },
      },
    };

    webpackPlugin.apply(mockCompiler);

    // Get the beforeCompile callback and call it
    const [, beforeCompileCallback] = (
      mockCompiler.hooks.beforeCompile.tapAsync as Mock
    ).mock.calls[0];

    const callback = vi.fn();
    await beforeCompileCallback({}, callback);

    expect(mockCompileTranslations).toHaveBeenCalledWith({
      localeDir: 'src/idioma/locales',
      outputDir: './src/idioma',
      defaultLocale: 'en',
      locales: undefined,
      useSuspense: undefined,
      projectRoot: process.cwd(),
    });
    expect(callback).toHaveBeenCalled();
  });

  it('only compiles once per build', async () => {
    const plugin = withIdioma({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });
    const config = plugin({});

    const mockConfig = { plugins: [] as any[] };
    const mockContext = {
      dev: false,
      isServer: true,
      webpack: {},
      buildId: 'test',
      dir: '/test',
    };

    config.webpack!(mockConfig as any, mockContext as any);

    const webpackPlugin = mockConfig.plugins[0];
    const mockCompiler = {
      hooks: {
        beforeCompile: { tapAsync: vi.fn() },
        watchRun: { tapAsync: vi.fn() },
      },
    };

    webpackPlugin.apply(mockCompiler);

    const [, beforeCompileCallback] = (
      mockCompiler.hooks.beforeCompile.tapAsync as Mock
    ).mock.calls[0];

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    await beforeCompileCallback({}, callback1);
    await beforeCompileCallback({}, callback2);

    // Should only compile once
    expect(mockCompileTranslations).toHaveBeenCalledTimes(1);
  });

  it('sets up watchRun hook in dev mode', () => {
    const plugin = withIdioma({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });
    const config = plugin({});

    const mockConfig = { plugins: [] as any[] };
    const mockContext = {
      dev: true, // Dev mode
      isServer: true,
      webpack: {},
      buildId: 'test',
      dir: '/test',
    };

    config.webpack!(mockConfig as any, mockContext as any);

    const webpackPlugin = mockConfig.plugins[0];
    const mockCompiler = {
      hooks: {
        beforeCompile: { tapAsync: vi.fn() },
        watchRun: { tapAsync: vi.fn() },
      },
    };

    webpackPlugin.apply(mockCompiler);

    expect(mockCompiler.hooks.watchRun.tapAsync).toHaveBeenCalled();
  });

  it('recompiles when PO files change in dev mode', async () => {
    const plugin = withIdioma({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });
    const config = plugin({});

    const mockConfig = { plugins: [] as any[] };
    const mockContext = {
      dev: true,
      isServer: true,
      webpack: {},
      buildId: 'test',
      dir: '/test',
    };

    config.webpack!(mockConfig as any, mockContext as any);

    const webpackPlugin = mockConfig.plugins[0];
    const mockCompiler = {
      hooks: {
        beforeCompile: { tapAsync: vi.fn() },
        watchRun: { tapAsync: vi.fn() },
      },
    };

    webpackPlugin.apply(mockCompiler);

    const [, watchRunCallback] = (mockCompiler.hooks.watchRun.tapAsync as Mock)
      .mock.calls[0];

    // Reset mock to track recompilation
    mockCompileTranslations.mockClear();

    // Simulate watching with PO file change
    const mockWatching = {
      modifiedFiles: new Set(['./src/idioma/locales/en.po']),
    };

    const callback = vi.fn();
    await watchRunCallback(mockWatching, callback);

    expect(mockCompileTranslations).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('does not recompile when non-PO files change', async () => {
    const plugin = withIdioma({
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
    });
    const config = plugin({});

    const mockConfig = { plugins: [] as any[] };
    const mockContext = {
      dev: true,
      isServer: true,
      webpack: {},
      buildId: 'test',
      dir: '/test',
    };

    config.webpack!(mockConfig as any, mockContext as any);

    const webpackPlugin = mockConfig.plugins[0];
    const mockCompiler = {
      hooks: {
        beforeCompile: { tapAsync: vi.fn() },
        watchRun: { tapAsync: vi.fn() },
      },
    };

    webpackPlugin.apply(mockCompiler);

    const [, watchRunCallback] = (mockCompiler.hooks.watchRun.tapAsync as Mock)
      .mock.calls[0];

    mockCompileTranslations.mockClear();

    const mockWatching = {
      modifiedFiles: new Set(['./src/app/page.tsx']),
    };

    const callback = vi.fn();
    await watchRunCallback(mockWatching, callback);

    expect(mockCompileTranslations).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });
});
