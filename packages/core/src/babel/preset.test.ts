import { describe, expect, it } from 'vitest';
import idiomaBabelPreset from './preset';

describe('idiomaBabelPreset', () => {
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

  it('defaults to inlined mode', () => {
    const result = idiomaBabelPreset();

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('inlined');
  });

  it('sets mode to suspense when useSuspense is true', () => {
    const result = idiomaBabelPreset(undefined, { useSuspense: true });

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('suspense');
  });

  it('sets mode to inlined when useSuspense is false', () => {
    const result = idiomaBabelPreset(undefined, { useSuspense: false });

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('inlined');
  });

  it('passes through custom options', () => {
    const result = idiomaBabelPreset(undefined, {
      useSuspense: true,
      locales: ['en', 'es'],
      outputDir: './src/i18n',
    });

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('suspense');
    expect(options.locales).toEqual(['en', 'es']);
    expect(options.outputDir).toBe('./src/i18n');
  });
});
