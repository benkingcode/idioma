import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defineConfig,
  getIdiomiPaths,
  loadConfig,
  type IdiomiConfig,
} from './config';

describe('CLI Config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idiomi-config-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('defineConfig', () => {
    it('returns the config object unchanged', () => {
      const config: IdiomiConfig = {
        idiomiDir: './src/idiomi',
        defaultLocale: 'en',
        locales: ['en', 'es'],
      };

      const result = defineConfig(config);

      expect(result).toEqual(config);
    });

    it('provides type safety helper', () => {
      const config = defineConfig({
        idiomiDir: './src/idiomi',
        defaultLocale: 'en',
      });

      expect(config.idiomiDir).toBe('./src/idiomi');
    });
  });

  describe('getIdiomiPaths', () => {
    it('computes localeDir from idiomiDir by default', () => {
      const config: IdiomiConfig = {
        idiomiDir: './src/idiomi',
        defaultLocale: 'en',
      };

      const paths = getIdiomiPaths(config);

      expect(paths.localeDir).toBe('src/idiomi/locales');
      expect(paths.outputDir).toBe('./src/idiomi');
    });

    it('uses localesDir override when provided', () => {
      const config: IdiomiConfig = {
        idiomiDir: './src/idiomi',
        localesDir: './locales',
        defaultLocale: 'en',
      };

      const paths = getIdiomiPaths(config);

      expect(paths.localeDir).toBe('./locales');
      expect(paths.outputDir).toBe('./src/idiomi');
    });
  });

  describe('loadConfig', () => {
    it('loads idiomi.config.ts from directory', async () => {
      const configContent = `
        export default {
          idiomiDir: './src/idiomi',
          defaultLocale: 'en',
          locales: ['en', 'es', 'fr'],
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.idiomiDir).toBe('./src/idiomi');
      expect(config.defaultLocale).toBe('en');
      expect(config.locales).toEqual(['en', 'es', 'fr']);
    });

    it('loads idiomi.config.js from directory', async () => {
      const configContent = `
        module.exports = {
          idiomiDir: './generated',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.js'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.idiomiDir).toBe('./generated');
    });

    it('prefers .ts over .js when both exist', async () => {
      await fs.writeFile(
        join(tempDir, 'idiomi.config.ts'),
        `export default { idiomiDir: './from-ts', defaultLocale: 'en' }`,
      );
      await fs.writeFile(
        join(tempDir, 'idiomi.config.js'),
        `module.exports = { idiomiDir: './from-js', defaultLocale: 'en' }`,
      );

      const config = await loadConfig(tempDir);

      expect(config.idiomiDir).toBe('./from-ts');
    });

    it('throws when no config file found', async () => {
      await expect(loadConfig(tempDir)).rejects.toThrow(
        'No idiomi config file found',
      );
    });

    it('merges with default values', async () => {
      const configContent = `
        export default {
          idiomiDir: './src/idiomi',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      // Should have default source patterns
      expect(config.sourcePatterns).toBeDefined();
      expect(config.sourcePatterns).toContain('**/*.tsx');
    });

    it('allows overriding source patterns', async () => {
      const configContent = `
        export default {
          idiomiDir: './src/idiomi',
          defaultLocale: 'en',
          sourcePatterns: ['src/**/*.tsx'],
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.sourcePatterns).toEqual(['src/**/*.tsx']);
    });

    it('defaults useSuspense to false', async () => {
      const configContent = `
        export default {
          idiomiDir: './src/idiomi',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.useSuspense).toBe(false);
    });

    it('accepts useSuspense: true', async () => {
      const configContent = `
        export default {
          idiomiDir: './src/idiomi',
          defaultLocale: 'en',
          useSuspense: true,
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.useSuspense).toBe(true);
    });

    it('accepts localesDir override', async () => {
      const configContent = `
        export default {
          idiomiDir: './src/idiomi',
          localesDir: './locales',
          defaultLocale: 'en',
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.localesDir).toBe('./locales');
    });

    it('accepts ai.guidelines in config', async () => {
      const configContent = `
        export default {
          idiomiDir: './src/idiomi',
          defaultLocale: 'en',
          ai: {
            guidelines: 'This is a formal business app. Use professional language.',
          },
        }
      `;
      await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

      const config = await loadConfig(tempDir);

      expect(config.ai?.guidelines).toBe(
        'This is a formal business app. Use professional language.',
      );
    });

    describe('validation', () => {
      it('throws on missing idiomiDir', async () => {
        await fs.writeFile(
          join(tempDir, 'idiomi.config.ts'),
          `export default { defaultLocale: 'en' }`,
        );

        await expect(loadConfig(tempDir)).rejects.toThrow('idiomiDir');
      });

      it('throws on missing defaultLocale', async () => {
        await fs.writeFile(
          join(tempDir, 'idiomi.config.ts'),
          `export default { idiomiDir: './src/idiomi' }`,
        );

        await expect(loadConfig(tempDir)).rejects.toThrow('defaultLocale');
      });

      it('throws on wrong type for idiomiDir', async () => {
        await fs.writeFile(
          join(tempDir, 'idiomi.config.ts'),
          `export default {
            idiomiDir: 123,
            defaultLocale: 'en',
          }`,
        );

        await expect(loadConfig(tempDir)).rejects.toThrow('idiomiDir');
      });

      it('throws on wrong type for locales', async () => {
        await fs.writeFile(
          join(tempDir, 'idiomi.config.ts'),
          `export default {
            idiomiDir: './src/idiomi',
            defaultLocale: 'en',
            locales: 'en,es',
          }`,
        );

        await expect(loadConfig(tempDir)).rejects.toThrow('locales');
      });

      it('warns when defaultLocale not in locales', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await fs.writeFile(
          join(tempDir, 'idiomi.config.ts'),
          `export default {
            idiomiDir: './src/idiomi',
            defaultLocale: 'en',
            locales: ['es', 'fr'],
          }`,
        );

        await loadConfig(tempDir);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('defaultLocale "en" is not in locales'),
        );

        warnSpy.mockRestore();
      });

      it('does not warn when defaultLocale is in locales', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await fs.writeFile(
          join(tempDir, 'idiomi.config.ts'),
          `export default {
            idiomiDir: './src/idiomi',
            defaultLocale: 'en',
            locales: ['en', 'es', 'fr'],
          }`,
        );

        await loadConfig(tempDir);

        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
      });
    });

    describe('routing config', () => {
      it('accepts routing.metadataBase', async () => {
        const configContent = `
          export default {
            idiomiDir: './src/idiomi',
            defaultLocale: 'en',
            routing: {
              metadataBase: 'https://example.com',
            },
          }
        `;
        await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

        const config = await loadConfig(tempDir);

        expect(config.routing?.metadataBase).toBe('https://example.com');
      });

      it('allows routing.metadataBase to be omitted (defaults to undefined)', async () => {
        const configContent = `
          export default {
            idiomiDir: './src/idiomi',
            defaultLocale: 'en',
            routing: {
              localizedPaths: true,
            },
          }
        `;
        await fs.writeFile(join(tempDir, 'idiomi.config.ts'), configContent);

        const config = await loadConfig(tempDir);

        expect(config.routing?.metadataBase).toBeUndefined();
      });
    });
  });
});
