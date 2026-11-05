import { describe, expect, it } from 'vitest';
import { defineConfig, readAiConfig } from './config';

describe('@idioma/ai config', () => {
  it('reads the ai block of idioma.config.ts', () => {
    const model = { provider: 'test', modelId: 'test-model' };
    expect(
      readAiConfig({
        model,
        guidelines: 'Formal tone.',
        providerOptions: { anthropic: { thinking: { type: 'disabled' } } },
      }),
    ).toEqual({
      model,
      guidelines: 'Formal tone.',
      providerOptions: { anthropic: { thinking: { type: 'disabled' } } },
    });
  });

  it('reads a missing ai block as empty', () => {
    expect(readAiConfig(undefined)).toEqual({});
  });

  it('says which setting is wrong', () => {
    expect(() => readAiConfig({ guidelines: 42 })).toThrow(
      /Invalid ai settings in idioma\.config\.ts:\n.*guidelines/,
    );
    expect(() => readAiConfig('claude')).toThrow(/Invalid ai settings/);
  });

  it('defineConfig returns the config as written', () => {
    const config = {
      idiomaDir: './src/idioma',
      defaultLocale: 'en',
      ai: { guidelines: 'Formal tone.' },
    };
    expect(defineConfig(config)).toBe(config);
  });
});
