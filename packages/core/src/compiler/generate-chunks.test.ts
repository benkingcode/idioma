import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Catalog } from '../po/types';
import type { ChunkAnalysis } from './chunk-analysis';
import { generateChunkModules } from './generate-chunks';

describe('generateChunkModules', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-chunks-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createCatalog(
    locale: string,
    messages: Record<string, string>,
  ): Catalog {
    const messageMap = new Map(
      Object.entries(messages).map(([key, translation]) => [
        key,
        { key, source: `Source ${key}`, translation, references: [] },
      ]),
    );
    return { locale, headers: {}, messages: messageMap };
  }

  it('creates chunks directory', async () => {
    const analysis: ChunkAnalysis = {
      files: new Map([
        [
          '/project/src/Home.tsx',
          { chunkId: 'Home_abc12345', keys: new Set(['key1']) },
        ],
      ]),
    };
    const catalogs = new Map([['en', createCatalog('en', { key1: 'Hello' })]]);

    await generateChunkModules({
      outputDir: tempDir,
      locales: ['en'],
      analysis,
      catalogs,
    });

    const stat = await fs.stat(join(tempDir, 'chunks'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('generates one file per (chunk x locale)', async () => {
    const analysis: ChunkAnalysis = {
      files: new Map([
        [
          '/project/src/Home.tsx',
          { chunkId: 'Home_abc12345', keys: new Set(['key1']) },
        ],
      ]),
    };
    const catalogs = new Map([
      ['en', createCatalog('en', { key1: 'Hello' })],
      ['es', createCatalog('es', { key1: 'Hola' })],
    ]);

    await generateChunkModules({
      outputDir: tempDir,
      locales: ['en', 'es'],
      analysis,
      catalogs,
    });

    const enFile = await fs.readFile(
      join(tempDir, 'chunks', 'Home_abc12345.en.ts'),
      'utf-8',
    );
    const esFile = await fs.readFile(
      join(tempDir, 'chunks', 'Home_abc12345.es.ts'),
      'utf-8',
    );

    expect(enFile).toContain('Hello');
    expect(esFile).toContain('Hola');
  });

  it('only includes keys used in that chunk', async () => {
    const analysis: ChunkAnalysis = {
      files: new Map([
        [
          '/project/src/Home.tsx',
          { chunkId: 'Home_abc12345', keys: new Set(['key1']) },
        ],
        [
          '/project/src/About.tsx',
          { chunkId: 'About_def67890', keys: new Set(['key2']) },
        ],
      ]),
    };
    const catalogs = new Map([
      ['en', createCatalog('en', { key1: 'Hello', key2: 'About' })],
    ]);

    await generateChunkModules({
      outputDir: tempDir,
      locales: ['en'],
      analysis,
      catalogs,
    });

    const homeFile = await fs.readFile(
      join(tempDir, 'chunks', 'Home_abc12345.en.ts'),
      'utf-8',
    );
    const aboutFile = await fs.readFile(
      join(tempDir, 'chunks', 'About_def67890.en.ts'),
      'utf-8',
    );

    expect(homeFile).toContain('Hello');
    expect(homeFile).not.toContain('About');
    expect(aboutFile).toContain('About');
    expect(aboutFile).not.toContain('Hello');
  });

  it('generates manifest.json mapping chunk IDs to source files', async () => {
    const analysis: ChunkAnalysis = {
      files: new Map([
        [
          '/project/src/Home.tsx',
          { chunkId: 'Home_abc12345', keys: new Set(['key1']) },
        ],
        [
          '/project/src/About.tsx',
          { chunkId: 'About_def67890', keys: new Set(['key2']) },
        ],
      ]),
    };
    const catalogs = new Map([
      ['en', createCatalog('en', { key1: 'Hello', key2: 'About' })],
    ]);

    await generateChunkModules({
      outputDir: tempDir,
      locales: ['en'],
      analysis,
      catalogs,
    });

    const manifest = JSON.parse(
      await fs.readFile(join(tempDir, 'manifest.json'), 'utf-8'),
    );

    expect(manifest.chunks['Home_abc12345']).toBe('/project/src/Home.tsx');
    expect(manifest.chunks['About_def67890']).toBe('/project/src/About.tsx');
  });

  it('generates valid TypeScript/JavaScript exports', async () => {
    const analysis: ChunkAnalysis = {
      files: new Map([
        [
          '/project/src/Home.tsx',
          { chunkId: 'Home_abc12345', keys: new Set(['key1']) },
        ],
      ]),
    };
    const catalogs = new Map([['en', createCatalog('en', { key1: 'Hello' })]]);

    await generateChunkModules({
      outputDir: tempDir,
      locales: ['en'],
      analysis,
      catalogs,
    });

    const content = await fs.readFile(
      join(tempDir, 'chunks', 'Home_abc12345.en.ts'),
      'utf-8',
    );

    expect(content).toContain('export default');
  });

  it('handles empty translations gracefully', async () => {
    const analysis: ChunkAnalysis = {
      files: new Map([
        [
          '/project/src/Home.tsx',
          { chunkId: 'Home_abc12345', keys: new Set(['key1']) },
        ],
      ]),
    };
    // Translation is empty string
    const catalogs = new Map([['en', createCatalog('en', { key1: '' })]]);

    await generateChunkModules({
      outputDir: tempDir,
      locales: ['en'],
      analysis,
      catalogs,
    });

    const content = await fs.readFile(
      join(tempDir, 'chunks', 'Home_abc12345.en.ts'),
      'utf-8',
    );

    expect(content).toContain('"key1"');
  });
});
