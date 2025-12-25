import { beforeEach, describe, expect, it, vi } from 'vitest';
import idiomaBabelPreset from './preset';

describe('idiomaBabelPreset', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset NODE_ENV for each test
    process.env.NODE_ENV = originalEnv;
  });

  it('exports a function', () => {
    expect(typeof idiomaBabelPreset).toBe('function');
  });

  it('returns a preset configuration object', () => {
    const result = idiomaBabelPreset();
    expect(result).toHaveProperty('plugins');
    expect(Array.isArray(result.plugins)).toBe(true);
  });

  it('includes the idioma babel plugin', () => {
    const result = idiomaBabelPreset();

    expect(result.plugins.length).toBe(1);
    expect(Array.isArray(result.plugins[0])).toBe(true);

    const [pluginPath] = result.plugins[0];
    expect(pluginPath).toBe('@idioma/core/babel');
  });

  it('sets mode to development when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';

    const result = idiomaBabelPreset();

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('development');
  });

  it('sets mode to production when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';

    const result = idiomaBabelPreset();

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('production');
  });

  it('defaults to development mode when NODE_ENV is not set', () => {
    delete process.env.NODE_ENV;

    const result = idiomaBabelPreset();

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('development');
  });

  it('passes through custom options', () => {
    const result = idiomaBabelPreset(undefined, {
      useSuspense: true,
      locales: ['en', 'es'],
      outputDir: './src/i18n',
    });

    const [, options] = result.plugins[0];
    expect(options.useSuspense).toBe(true);
    expect(options.locales).toEqual(['en', 'es']);
    expect(options.outputDir).toBe('./src/i18n');
  });
});
