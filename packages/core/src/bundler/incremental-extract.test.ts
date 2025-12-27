import { promises as fs } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPoFile, writePoFile } from '../po/parser';
import type { Catalog } from '../po/types';
import { extractAndMergeFile } from './incremental-extract';

// Mock the file system
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

// Mock the PO parser
vi.mock('../po/parser', () => ({
  loadPoFile: vi.fn(),
  writePoFile: vi.fn(),
}));

const mockLoadPoFile = vi.mocked(loadPoFile);
const mockWritePoFile = vi.mocked(writePoFile);
const mockReadFile = vi.mocked(fs.readFile);

describe('extractAndMergeFile', () => {
  const baseOptions = {
    projectRoot: '/project',
    idiomaDir: '/project/src/idioma',
    localeDir: '/project/src/idioma/locales',
    defaultLocale: 'en',
    locales: ['en', 'es'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function createCatalog(
    locale: string,
    messages: Array<{
      key: string;
      source: string;
      translation: string;
      references?: string[];
      flags?: string[];
    }>,
  ): Catalog {
    const catalog: Catalog = {
      locale,
      headers: { Language: locale },
      messages: new Map(),
    };
    for (const msg of messages) {
      catalog.messages.set(msg.key, {
        key: msg.key,
        source: msg.source,
        translation: msg.translation,
        references: msg.references ?? [],
        flags: msg.flags,
      });
    }
    return catalog;
  }

  it('extracts messages from a file and adds to PO catalogs', async () => {
    // Mock file content with a Trans component
    // Import path must resolve to idiomaDir (/project/src/idioma)
    // From /project/src/App.tsx, "./idioma" resolves to /project/src/idioma
    const fileContent = `
      import { Trans } from './idioma';
      export function App() {
        return <Trans>Hello world</Trans>;
      }
    `;
    mockReadFile.mockResolvedValue(fileContent);

    // Mock empty existing catalogs
    mockLoadPoFile.mockImplementation(async (path, locale) => {
      return createCatalog(locale, []);
    });

    const result = await extractAndMergeFile({
      ...baseOptions,
      filePath: '/project/src/App.tsx',
    });

    expect(result.added).toBeGreaterThan(0);
    expect(mockWritePoFile).toHaveBeenCalledTimes(2); // en and es
  });

  it('removes file reference when message is deleted from file', async () => {
    // Mock file with no Trans components
    const fileContent = `
      export function App() {
        return <div>No translations</div>;
      }
    `;
    mockReadFile.mockResolvedValue(fileContent);

    // Mock catalogs with existing message that has only this file as reference
    // Message has 'extracted' flag so it's eligible for auto-deletion
    mockLoadPoFile.mockImplementation(async (path, locale) => {
      return createCatalog(locale, [
        {
          key: 'abc123',
          source: 'abc123',
          translation: locale === 'en' ? 'Hello world' : '',
          references: ['src/App.tsx'],
          flags: ['extracted'],
        },
      ]);
    });

    const result = await extractAndMergeFile({
      ...baseOptions,
      filePath: '/project/src/App.tsx',
    });

    // Message should be removed since it's untranslated in es and no longer in file
    expect(result.removed).toBeGreaterThan(0);
  });

  it('preserves messages with translations in other locales', async () => {
    // Mock file with no Trans components
    const fileContent = `
      export function App() {
        return <div>No translations</div>;
      }
    `;
    mockReadFile.mockResolvedValue(fileContent);

    // Mock catalogs - English has message, Spanish has translation
    // Both have 'extracted' flag, but Spanish translation should prevent deletion
    const enCatalog = createCatalog('en', [
      {
        key: 'abc123',
        source: 'abc123',
        translation: 'Hello world',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
    ]);
    const esCatalog = createCatalog('es', [
      {
        key: 'abc123',
        source: 'abc123',
        translation: 'Hola mundo',
        references: ['src/App.tsx'],
        flags: ['extracted'],
      },
    ]);

    mockLoadPoFile.mockImplementation(async (path, locale) => {
      return locale === 'en' ? { ...enCatalog } : { ...esCatalog };
    });

    const result = await extractAndMergeFile({
      ...baseOptions,
      filePath: '/project/src/App.tsx',
    });

    // Message should NOT be removed because Spanish has a translation
    expect(result.removed).toBe(0);
  });

  it('uses file-only references (no line numbers)', async () => {
    const fileContent = `
      import { Trans } from './idioma';
      export function App() {
        return <Trans>Hello</Trans>;
      }
    `;
    mockReadFile.mockResolvedValue(fileContent);
    mockLoadPoFile.mockImplementation(async (path, locale) => {
      return createCatalog(locale, []);
    });

    await extractAndMergeFile({
      ...baseOptions,
      filePath: '/project/src/App.tsx',
    });

    // Check that writePoFile was called with catalog containing file-only references
    const writeCalls = mockWritePoFile.mock.calls;
    expect(writeCalls.length).toBeGreaterThan(0);

    const [, catalog] = writeCalls[0];
    const messages = [...catalog.messages.values()];
    expect(messages.length).toBeGreaterThan(0);

    // References should be file paths without line numbers
    for (const msg of messages) {
      for (const ref of msg.references ?? []) {
        expect(ref).not.toMatch(/:\d+$/); // Should not end with :number
      }
    }
  });
});
