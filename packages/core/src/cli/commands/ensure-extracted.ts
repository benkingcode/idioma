import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import type { IdiomaConfig } from '../config.js';
import { extractMessages } from './extract.js';

export interface EnsureExtractedOptions {
  localeDir: string;
  locales: string[];
  cwd: string;
  config: IdiomaConfig;
  onExtractStart?: () => void;
  onExtractComplete?: (result: { messages: number; files: number }) => void;
}

export interface EnsureExtractedResult {
  extracted: boolean;
  messages?: number;
  files?: number;
}

/**
 * Check if all PO files exist, and run extract if any are missing.
 * Returns whether extraction was performed.
 */
export async function ensureExtracted(
  options: EnsureExtractedOptions,
): Promise<EnsureExtractedResult> {
  const { localeDir, locales, cwd, config, onExtractStart, onExtractComplete } =
    options;

  // Check if all required locale PO files exist
  const missingLocales: string[] = [];

  for (const locale of locales) {
    const poPath = join(localeDir, `${locale}.po`);
    try {
      await fs.access(poPath);
    } catch {
      missingLocales.push(locale);
    }
  }

  // All files exist, nothing to do
  if (missingLocales.length === 0) {
    return { extracted: false };
  }

  // Run extraction to create missing files
  onExtractStart?.();

  const result = await extractMessages({
    cwd,
    sourcePatterns: config.sourcePatterns ?? ['**/*.tsx', '**/*.jsx'],
    localeDir,
    defaultLocale: config.defaultLocale,
    locales: config.locales,
    idiomaDir: resolve(cwd, config.idiomaDir),
  });

  onExtractComplete?.({
    messages: result.messages.length,
    files: result.files,
  });

  return {
    extracted: true,
    messages: result.messages.length,
    files: result.files,
  };
}
