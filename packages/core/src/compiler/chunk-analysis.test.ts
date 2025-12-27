import { describe, expect, it } from 'vitest';
import type { ExtractedMessage } from '../babel/extract-trans';
import { analyzeChunks } from './chunk-analysis';

describe('analyzeChunks', () => {
  const projectRoot = '/project';

  function createMessage(
    key: string,
    filePath: string,
    line = 1,
  ): ExtractedMessage {
    return {
      key,
      source: `Message ${key}`,
      placeholders: {},
      components: [],
      references: [`${filePath}:${line}`],
    };
  }

  it('groups keys by source file', () => {
    const messages = [
      createMessage('key1', '/project/src/HomePage.tsx'),
      createMessage('key2', '/project/src/HomePage.tsx'),
      createMessage('key3', '/project/src/About.tsx'),
    ];

    const analysis = analyzeChunks(messages, projectRoot);

    expect(analysis.files.size).toBe(2);
    expect(analysis.files.get('/project/src/HomePage.tsx')?.keys).toEqual(
      new Set(['key1', 'key2']),
    );
    expect(analysis.files.get('/project/src/About.tsx')?.keys).toEqual(
      new Set(['key3']),
    );
  });

  it('generates correct chunk IDs', () => {
    const messages = [createMessage('key1', '/project/src/HomePage.tsx')];

    const analysis = analyzeChunks(messages, projectRoot);

    const homeInfo = analysis.files.get('/project/src/HomePage.tsx');
    expect(homeInfo?.chunkId).toMatch(/^HomePage_[a-zA-Z0-9_-]{8}$/);
  });

  it('handles multiple keys per file', () => {
    const messages = [
      createMessage('key1', '/project/src/Page.tsx'),
      createMessage('key2', '/project/src/Page.tsx'),
      createMessage('key3', '/project/src/Page.tsx'),
    ];

    const analysis = analyzeChunks(messages, projectRoot);

    const pageInfo = analysis.files.get('/project/src/Page.tsx');
    expect(pageInfo?.keys.size).toBe(3);
    expect(pageInfo?.keys).toContain('key1');
    expect(pageInfo?.keys).toContain('key2');
    expect(pageInfo?.keys).toContain('key3');
  });

  it('handles same key appearing in multiple files', () => {
    // Same key used in both files (e.g., shared component with inline Trans)
    const messages = [
      createMessage('shared-key', '/project/src/PageA.tsx'),
      createMessage('shared-key', '/project/src/PageB.tsx'),
    ];

    const analysis = analyzeChunks(messages, projectRoot);

    expect(analysis.files.size).toBe(2);
    expect(analysis.files.get('/project/src/PageA.tsx')?.keys).toContain(
      'shared-key',
    );
    expect(analysis.files.get('/project/src/PageB.tsx')?.keys).toContain(
      'shared-key',
    );
  });

  it('extracts file path from reference with line number', () => {
    const messages = [
      {
        key: 'key1',
        source: 'Hello',
        placeholders: {},
        components: [],
        references: ['/project/src/Page.tsx:42'],
      },
    ];

    const analysis = analyzeChunks(messages, projectRoot);

    expect(analysis.files.has('/project/src/Page.tsx')).toBe(true);
  });

  it('extracts file path from reference without line number', () => {
    // Incremental extraction saves references without line numbers to reduce git noise
    const messages = [
      {
        key: 'key1',
        source: 'Hello',
        placeholders: {},
        components: [],
        references: ['src/components/Page.tsx'],
      },
    ];

    const analysis = analyzeChunks(messages, projectRoot);

    expect(analysis.files.has('src/components/Page.tsx')).toBe(true);
  });

  it('returns empty analysis for empty messages array', () => {
    const analysis = analyzeChunks([], projectRoot);

    expect(analysis.files.size).toBe(0);
  });
});
