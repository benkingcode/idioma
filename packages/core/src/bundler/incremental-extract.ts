import { promises as fs } from 'fs';
import { join, relative } from 'path';
import { extractFromFile, messagesToCatalog } from '../cli/commands/extract.js';
import { mergeFileIntoCatalog } from '../po/merge.js';
import { loadPoFile, writePoFile } from '../po/parser.js';
import type { Catalog } from '../po/types.js';

/**
 * Options for incremental single-file extraction
 */
export interface IncrementalExtractOptions {
  /** Absolute path to the changed file */
  filePath: string;
  /** Project root directory */
  projectRoot: string;
  /** Absolute path to idiomi directory */
  idiomiDir: string;
  /** Absolute path to locale directory containing PO files */
  localeDir: string;
  /** Default/source locale */
  defaultLocale: string;
  /** All supported locales */
  locales: string[];
}

/**
 * Result of incremental extraction
 */
export interface IncrementalExtractResult {
  /** Number of messages added */
  added: number;
  /** Number of messages updated */
  updated: number;
  /** Number of messages removed (orphaned with no translations) */
  removed: number;
}

/**
 * Extract messages from a single file and merge into existing PO files.
 *
 * This function handles the complete incremental extraction flow:
 * 1. Read and parse the source file
 * 2. Extract messages using Babel
 * 3. Load existing PO catalogs for all locales
 * 4. Merge extracted messages with reference-aware cleanup
 * 5. Write updated PO files
 *
 * Key behaviors:
 * - Uses file-only references (no line numbers) to avoid noisy git diffs
 * - Removes orphaned messages only if they have no translations in any locale
 * - Preserves existing translations
 *
 * @param options - Extraction options including file path and locale config
 * @returns Result with counts of added, updated, and removed messages
 */
export async function extractAndMergeFile(
  options: IncrementalExtractOptions,
): Promise<IncrementalExtractResult> {
  const {
    filePath,
    projectRoot,
    idiomiDir,
    localeDir,
    defaultLocale,
    locales,
  } = options;

  // Compute relative path for references (file-only, no line numbers)
  const relativePath = relative(projectRoot, filePath);

  // Read file content
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    // File might have been deleted or is unreadable
    console.warn(`[idiomi] Could not read ${relativePath}:`, error);
    content = ''; // Treat as empty file - will remove all references from this file
  }

  // Extract messages from the file
  const messages = await extractFromFile(
    content,
    filePath,
    relativePath,
    idiomiDir,
  );

  // Load all locale catalogs upfront (needed for translation checking)
  const catalogsByLocale = new Map<string, Catalog>();
  for (const locale of locales) {
    const poPath = join(localeDir, `${locale}.po`);
    try {
      const catalog = await loadPoFile(poPath, locale);
      catalogsByLocale.set(locale, catalog);
    } catch {
      // Create empty catalog if file doesn't exist
      catalogsByLocale.set(locale, {
        locale,
        headers: { Language: locale },
        messages: new Map(),
      });
    }
  }

  // Aggregate results
  const result: IncrementalExtractResult = {
    added: 0,
    updated: 0,
    removed: 0,
  };

  // Process each locale
  for (const locale of locales) {
    const catalog = catalogsByLocale.get(locale)!;

    // Convert extracted messages to catalog format
    const extractedCatalog = messagesToCatalog(
      messages,
      locale,
      undefined, // namespace
      defaultLocale,
    );

    // Get other locale catalogs for translation checking
    const otherLocaleCatalogs = [...catalogsByLocale.values()].filter(
      (c) => c.locale !== locale,
    );

    // Merge with reference-aware cleanup
    const mergeResult = mergeFileIntoCatalog(catalog, extractedCatalog, {
      filePath: relativePath,
      defaultLocale,
      otherLocaleCatalogs,
    });

    // Aggregate counts (only count once, not per locale)
    if (locale === defaultLocale) {
      result.added = mergeResult.added.length;
      result.updated = mergeResult.updated.length;
      result.removed = mergeResult.removed.length;
    }

    // Write updated catalog
    const poPath = join(localeDir, `${locale}.po`);
    await writePoFile(poPath, catalog);
  }

  return result;
}
