import { describe, expect, it, vi } from 'vitest';
import idiomaVitePlugin, { type IdiomaViteOptions } from './vite';

// Mock ensureGitignore
vi.mock('../utils/gitignore', () => ({
  ensureGitignore: vi.fn().mockResolvedValue(undefined),
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
});
