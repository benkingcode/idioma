import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineConfig, loadConfig, type IdiomaConfig } from './config';

describe('CLI Config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-config-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('defineConfig', () => {
    it('returns the config object unchanged', () => {
      const config: IdiomaConfig = {
        localeDir: './locales',
        outputDir: './src/idioma',
        defaultLocale: 'en',
        locales: ['en', 'es'],
      };

      const result = defineConfig(config);

      expect(result).toEqual(config);
    });

    it('provides type safety helper', () => {
      const config = defineConfig({
        localeDir: './locales',
        outputDir: './src/idioma',
        defaultLocale: 'en',
      });

      expect(config.localeDir).toBe('./locales');
    });
  });

  describe('loadConfig', () => {
    it('loads idioma.config.ts from directory', async () => {
      const configContent = `
        export default {
          localeDir: './locales',
          outputDir: './src/idioma',
          defaultLocale: 'en',
          locales: ['en', 'es', 'fr'],
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.localeDir).toBe('./locales');
      expect(config.outputDir).toBe('./src/idioma');
      expect(config.defaultLocale).toBe('en');
      expect(config.locales).toEqual(['en', 'es', 'fr']);
    });

    it('loads idioma.config.js from directory', async () => {
      const configContent = `
        module.exports = {
          localeDir: './translations',
          outputDir: './generated',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.js'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.localeDir).toBe('./translations');
      expect(config.outputDir).toBe('./generated');
    });

    it('prefers .ts over .js when both exist', async () => {
      await fs.writeFile(
        join(tempDir, 'idioma.config.ts'),
        `export default { localeDir: './from-ts', outputDir: './out', defaultLocale: 'en' }`,
      );
      await fs.writeFile(
        join(tempDir, 'idioma.config.js'),
        `module.exports = { localeDir: './from-js', outputDir: './out', defaultLocale: 'en' }`,
      );

      const config = await loadConfig(tempDir);

      expect(config.localeDir).toBe('./from-ts');
    });

    it('throws when no config file found', async () => {
      await expect(loadConfig(tempDir)).rejects.toThrow(
        'No idioma config file found',
      );
    });

    it('merges with default values', async () => {
      const configContent = `
        export default {
          localeDir: './locales',
          outputDir: './src/idioma',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      // Should have default source patterns
      expect(config.sourcePatterns).toBeDefined();
      expect(config.sourcePatterns).toContain('**/*.tsx');
    });

    it('allows overriding source patterns', async () => {
      const configContent = `
        export default {
          localeDir: './locales',
          outputDir: './src/idioma',
          defaultLocale: 'en',
          sourcePatterns: ['src/**/*.tsx'],
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.sourcePatterns).toEqual(['src/**/*.tsx']);
    });
  });
});
