import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defineConfig,
  getIdiomaPaths,
  loadConfig,
  type IdiomaConfig,
} from './config';

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
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
        locales: ['en', 'es'],
      };

      const result = defineConfig(config);

      expect(result).toEqual(config);
    });

    it('provides type safety helper', () => {
      const config = defineConfig({
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
      });

      expect(config.idiomaDir).toBe('./src/idioma');
    });
  });

  describe('getIdiomaPaths', () => {
    it('computes localeDir from idiomaDir by default', () => {
      const config: IdiomaConfig = {
        idiomaDir: './src/idioma',
        defaultLocale: 'en',
      };

      const paths = getIdiomaPaths(config);

      expect(paths.localeDir).toBe('src/idioma/locales');
      expect(paths.outputDir).toBe('./src/idioma');
    });

    it('uses localesDir override when provided', () => {
      const config: IdiomaConfig = {
        idiomaDir: './src/idioma',
        localesDir: './locales',
        defaultLocale: 'en',
      };

      const paths = getIdiomaPaths(config);

      expect(paths.localeDir).toBe('./locales');
      expect(paths.outputDir).toBe('./src/idioma');
    });
  });

  describe('loadConfig', () => {
    it('loads idioma.config.ts from directory', async () => {
      const configContent = `
        export default {
          idiomaDir: './src/idioma',
          defaultLocale: 'en',
          locales: ['en', 'es', 'fr'],
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.idiomaDir).toBe('./src/idioma');
      expect(config.defaultLocale).toBe('en');
      expect(config.locales).toEqual(['en', 'es', 'fr']);
    });

    it('loads idioma.config.js from directory', async () => {
      const configContent = `
        module.exports = {
          idiomaDir: './generated',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.js'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.idiomaDir).toBe('./generated');
    });

    it('prefers .ts over .js when both exist', async () => {
      await fs.writeFile(
        join(tempDir, 'idioma.config.ts'),
        `export default { idiomaDir: './from-ts', defaultLocale: 'en' }`,
      );
      await fs.writeFile(
        join(tempDir, 'idioma.config.js'),
        `module.exports = { idiomaDir: './from-js', defaultLocale: 'en' }`,
      );

      const config = await loadConfig(tempDir);

      expect(config.idiomaDir).toBe('./from-ts');
    });

    it('throws when no config file found', async () => {
      await expect(loadConfig(tempDir)).rejects.toThrow(
        'No idioma config file found',
      );
    });

    it('merges with default values', async () => {
      const configContent = `
        export default {
          idiomaDir: './src/idioma',
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
          idiomaDir: './src/idioma',
          defaultLocale: 'en',
          sourcePatterns: ['src/**/*.tsx'],
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.sourcePatterns).toEqual(['src/**/*.tsx']);
    });

    it('defaults useSuspense to false', async () => {
      const configContent = `
        export default {
          idiomaDir: './src/idioma',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.useSuspense).toBe(false);
    });

    it('accepts useSuspense: true', async () => {
      const configContent = `
        export default {
          idiomaDir: './src/idioma',
          defaultLocale: 'en',
          useSuspense: true,
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.useSuspense).toBe(true);
    });

    it('accepts localesDir override', async () => {
      const configContent = `
        export default {
          idiomaDir: './src/idioma',
          localesDir: './locales',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.localesDir).toBe('./locales');
    });

    it('accepts ai.guidelines in config', async () => {
      const configContent = `
        export default {
          idiomaDir: './src/idioma',
          defaultLocale: 'en',
          ai: {
            provider: 'anthropic',
            guidelines: 'This is a formal business app. Use professional language.',
          },
        }
      `;
      await fs.writeFile(join(tempDir, 'idioma.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.ai?.provider).toBe('anthropic');
      expect(config.ai?.guidelines).toBe(
        'This is a formal business app. Use professional language.',
      );
    });
  });
});
