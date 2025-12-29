import { describe, expect, it, vi } from 'vitest';
import idiomiVitePlugin, { type IdiomiViteOptions } from './vite';

// Mock ensureGitignore
vi.mock('../utils/gitignore', () => ({
  ensureGitignore: vi.fn().mockResolvedValue(undefined),
}));

describe('Idiomi Vite Plugin', () => {
  it('creates a plugin with correct name', () => {
    const plugin = idiomiVitePlugin({
      idiomiDir: './src/idiomi',
      defaultLocale: 'en',
    });

    expect(plugin.name).toBe('idiomi');
  });

  it('returns plugin object with expected hooks', () => {
    const plugin = idiomiVitePlugin({
      idiomiDir: './src/idiomi',
      defaultLocale: 'en',
    });

    expect(plugin).toHaveProperty('name');
    expect(plugin).toHaveProperty('configResolved');
    expect(plugin).toHaveProperty('buildStart');
  });

  it('accepts all configuration options', () => {
    const options: IdiomiViteOptions = {
      idiomiDir: './src/idiomi',
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
      watch: true,
    };

    const plugin = idiomiVitePlugin(options);

    expect(plugin.name).toBe('idiomi');
  });

  it('has enforce: pre for early processing', () => {
    const plugin = idiomiVitePlugin({
      idiomiDir: './src/idiomi',
      defaultLocale: 'en',
    });

    expect(plugin.enforce).toBe('pre');
  });
});
