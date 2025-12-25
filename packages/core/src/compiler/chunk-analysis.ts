import type { ExtractedMessage } from '../babel/extract-trans.js';
import type { Catalog } from '../po/types.js';
import { getChunkId } from './chunk-id.js';

export interface ChunkInfo {
  /** Unique chunk identifier */
  chunkId: string;
  /** Set of translation keys used in this file */
  keys: Set<string>;
}

export interface ChunkAnalysis {
  /** Map of source file path → chunk info */
  files: Map<string, ChunkInfo>;
}

/**
 * Analyze extracted messages to determine chunk groupings.
 *
 * Each source file becomes its own chunk, containing all translation
 * keys used in that file.
 *
 * @param extractedMessages - Messages extracted from source files
 * @param projectRoot - Project root for computing relative paths
 * @returns Analysis of chunks and their keys
 */
export function analyzeChunks(
  extractedMessages: ExtractedMessage[],
  projectRoot: string,
): ChunkAnalysis {
  const files = new Map<string, ChunkInfo>();

  for (const msg of extractedMessages) {
    // Extract file path from reference (format: "filepath:line")
    const reference = msg.references[0];
    if (!reference) continue;

    const filePath = parseFilePath(reference);
    if (!filePath) continue;

    addKeyToFile(files, filePath, msg.key, projectRoot);
  }

  return { files };
}

/**
 * Analyze catalogs to determine chunk groupings.
 *
 * Uses the references stored in PO messages to map keys to source files.
 *
 * @param catalogs - Map of locale to catalog
 * @param projectRoot - Project root for computing relative paths
 * @returns Analysis of chunks and their keys
 */
export function analyzeChunksFromCatalogs(
  catalogs: Map<string, Catalog>,
  projectRoot: string,
): ChunkAnalysis {
  const files = new Map<string, ChunkInfo>();

  // Use any catalog to get the references (they should be the same across locales)
  const firstCatalog = catalogs.values().next().value;
  if (!firstCatalog) return { files };

  for (const [key, message] of firstCatalog.messages) {
    const reference = message.references?.[0];
    if (!reference) continue;

    const filePath = parseFilePath(reference);
    if (!filePath) continue;

    addKeyToFile(files, filePath, key, projectRoot);
  }

  return { files };
}

/**
 * Parse file path from reference string (format: "filepath:line")
 */
function parseFilePath(reference: string): string | null {
  const filePath = reference.split(':').slice(0, -1).join(':');
  return filePath || null;
}

/**
 * Add a key to the file's chunk info
 */
function addKeyToFile(
  files: Map<string, ChunkInfo>,
  filePath: string,
  key: string,
  projectRoot: string,
): void {
  const existing = files.get(filePath);
  if (existing) {
    existing.keys.add(key);
  } else {
    files.set(filePath, {
      chunkId: getChunkId(filePath, projectRoot),
      keys: new Set([key]),
    });
  }
}
