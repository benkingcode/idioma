import { describe, expect, it } from 'vitest';
import {
  generateConfigModule,
  generateConfigTypes,
  type ConfigGeneratorOptions,
} from './generate-config.js';

describe('generateConfigModule', () => {
  const baseOptions: ConfigGeneratorOptions = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
  };

  it('generates config with locales and defaultLocale', () => {
    const result = generateConfigModule(baseOptions);

    expect(result).toContain('export const locales = ["en","es","fr"]');
    expect(result).toContain('export const defaultLocale = "en"');
  });

  it('generates config with prefixStrategy when provided', () => {
    const result = generateConfigModule({
      ...baseOptions,
      prefixStrategy: 'always',
    });

    expect(result).toContain('export const prefixStrategy = "always"');
  });

  it('uses default prefixStrategy as-needed when not provided', () => {
    const result = generateConfigModule(baseOptions);

    expect(result).toContain('export const prefixStrategy = "as-needed"');
  });

  it('generates detection config with defaults', () => {
    const result = generateConfigModule(baseOptions);

    expect(result).toContain('export const detection = {');
    expect(result).toContain('"order":["cookie","header"]');
    expect(result).toContain('"cookieName":"IDIOMA_LOCALE"');
    expect(result).toContain('"algorithm":"best fit"');
  });

  it('generates detection config with custom values', () => {
    const result = generateConfigModule({
      ...baseOptions,
      detection: {
        order: ['header', 'cookie'],
        cookieName: 'MY_LOCALE',
        algorithm: 'lookup',
      },
    });

    expect(result).toContain('"order":["header","cookie"]');
    expect(result).toContain('"cookieName":"MY_LOCALE"');
    expect(result).toContain('"algorithm":"lookup"');
  });

  it('supports prefixStrategy never', () => {
    const result = generateConfigModule({
      ...baseOptions,
      prefixStrategy: 'never',
    });

    expect(result).toContain('export const prefixStrategy = "never"');
  });
});

describe('generateConfigTypes', () => {
  const baseOptions: ConfigGeneratorOptions = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
  };

  it('generates locale type as readonly tuple', () => {
    const result = generateConfigTypes(baseOptions);

    expect(result).toContain(
      'export declare const locales: readonly ["en", "es", "fr"]',
    );
  });

  it('generates defaultLocale as literal type', () => {
    const result = generateConfigTypes(baseOptions);

    expect(result).toContain('export declare const defaultLocale: "en"');
  });

  it('generates prefixStrategy with union type', () => {
    const result = generateConfigTypes(baseOptions);

    expect(result).toContain(
      'export declare const prefixStrategy: "always" | "as-needed" | "never"',
    );
  });

  it('generates detection type', () => {
    const result = generateConfigTypes(baseOptions);

    expect(result).toContain('export declare const detection: {');
    expect(result).toContain(
      'readonly order: readonly ("cookie" | "header")[]',
    );
    expect(result).toContain('readonly cookieName: string');
    expect(result).toContain('readonly algorithm: "lookup" | "best fit"');
  });
});
