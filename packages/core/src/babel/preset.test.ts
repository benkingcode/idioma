import { describe, expect, it } from 'vitest';
import idiomiBabelPreset from './preset';

describe('idiomiBabelPreset', () => {
  it('exports a function', () => {
    expect(typeof idiomiBabelPreset).toBe('function');
  });

  it('returns a preset configuration object', () => {
    const result = idiomiBabelPreset();
    expect(result).toHaveProperty('plugins');
    expect(Array.isArray(result.plugins)).toBe(true);
  });

  it('includes the idiomi babel plugin', () => {
    const result = idiomiBabelPreset();

    expect(result.plugins.length).toBe(1);
    expect(Array.isArray(result.plugins[0])).toBe(true);

    const [pluginPath] = result.plugins[0];
    expect(pluginPath).toBe('@idiomi/core/babel');
  });

  it('defaults to inlined mode', () => {
    const result = idiomiBabelPreset();

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('inlined');
  });

  it('sets mode to suspense when useSuspense is true', () => {
    const result = idiomiBabelPreset(undefined, { useSuspense: true });

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('suspense');
  });

  it('sets mode to inlined when useSuspense is false', () => {
    const result = idiomiBabelPreset(undefined, { useSuspense: false });

    const [, options] = result.plugins[0];
    expect(options.mode).toBe('inlined');
  });

  it('passes through custom options', () => {
    const result = idiomiBabelPreset(undefined, {
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
