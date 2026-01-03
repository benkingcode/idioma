import type {
  Catalog,
  IncrementalMergeOptions,
  IncrementalMergeResult,
  MergeOptions,
  MergeResult,
} from './types.js';

/**
 * Merge extracted messages into an existing catalog.
 *
 * This function modifies the existing catalog in-place:
 * - Adds new messages from extracted
 * - Updates references and comments from extracted
 * - Preserves existing translations
 * - Optionally removes obsolete messages (clean option)
 * - Optionally marks changed sources as fuzzy (markFuzzy option)
 *
 * @param existing - The existing catalog with translations
 * @param extracted - The newly extracted messages (translations are empty)
 * @param options - Merge options
 * @returns Result containing what was added, updated, removed, and marked fuzzy
 */
export function mergeCatalogs(
  existing: Catalog,
  extracted: Catalog,
  options: MergeOptions = {},
): MergeResult {
  const { clean = false } = options;

  const result: MergeResult = {
    added: [],
    updated: [],
    removed: [],
    markedFuzzy: [],
  };

  // Track which existing keys are still in extracted
  const extractedKeys = new Set<string>();

  // Process each extracted message
  for (const [key, extractedMsg] of extracted.messages) {
    extractedKeys.add(key);

    const existingMsg = existing.messages.get(key);

    if (!existingMsg) {
      // New message - add it with source text as initial translation (fallback)
      existing.messages.set(key, {
        ...extractedMsg,
        // Keep extractedMsg.translation as the initial value (source text fallback)
      });
      result.added.push(key);
    } else {
      // Existing message - update references and context but preserve translation
      existingMsg.references = extractedMsg.references;
      // Only overwrite comments if extracted message has them
      if (extractedMsg.comments && extractedMsg.comments.length > 0) {
        existingMsg.comments = extractedMsg.comments;
      }
      existingMsg.context = extractedMsg.context;

      // Track as updated if references changed
      result.updated.push(key);
    }
  }

  // Handle removal of obsolete messages
  // Only remove messages that have the 'extracted' flag (idiomi-created)
  // TMS-imported messages (without the flag) are never auto-deleted
  if (clean) {
    const keysToRemove: string[] = [];

    for (const [key, msg] of existing.messages) {
      if (!extractedKeys.has(key)) {
        // Only remove if message was extracted by idiomi
        const isIdiomiExtracted = msg.flags?.includes('extracted');
        if (isIdiomiExtracted) {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      existing.messages.delete(key);
      result.removed.push(key);
    }
  }

  return result;
}

/**
 * Merge messages from a single file into existing catalog.
 *
 * Unlike mergeCatalogs(), this function:
 * 1. First removes filePath from references of all existing messages
 * 2. Then adds filePath to references of extracted messages (appending, not replacing)
 * 3. Removes orphaned messages (no references) only if they have no translations in other locales
 *
 * This enables incremental extraction where only one file is processed at a time.
 *
 * @param existing - The existing catalog with translations (modified in-place)
 * @param extracted - The newly extracted messages from a single file
 * @param options - Incremental merge options including filePath and other locale catalogs
 * @returns Result containing what was added, updated, removed
 */
export function mergeFileIntoCatalog(
  existing: Catalog,
  extracted: Catalog,
  options: IncrementalMergeOptions,
): IncrementalMergeResult {
  const { filePath, defaultLocale, otherLocaleCatalogs = [] } = options;

  const result: IncrementalMergeResult = {
    added: [],
    updated: [],
    removed: [],
  };

  // Step 1: Remove filePath from references of all existing messages
  for (const [key, msg] of existing.messages) {
    if (msg.references) {
      msg.references = msg.references.filter((ref) => ref !== filePath);
    }
  }

  // Step 2: Process extracted messages - add or update
  const extractedKeys = new Set<string>();
  for (const [key, extractedMsg] of extracted.messages) {
    extractedKeys.add(key);

    const existingMsg = existing.messages.get(key);

    if (!existingMsg) {
      // New message - add it
      existing.messages.set(key, {
        ...extractedMsg,
        references: [filePath],
      });
      result.added.push(key);
    } else {
      // Existing message - add filePath to references if not already present
      if (!existingMsg.references) {
        existingMsg.references = [];
      }
      if (!existingMsg.references.includes(filePath)) {
        existingMsg.references.push(filePath);
      }
      // Update comments if extracted has them
      if (extractedMsg.comments && extractedMsg.comments.length > 0) {
        existingMsg.comments = extractedMsg.comments;
      }
      result.updated.push(key);
    }
  }

  // Step 3: Find and remove orphaned messages
  // Only auto-delete if:
  // - No references remain (orphaned)
  // - Has 'extracted' flag (idiomi-created, not TMS-imported)
  // - No translations in other locales
  const keysToRemove: string[] = [];

  for (const [key, msg] of existing.messages) {
    // Skip if message still has references
    if (msg.references && msg.references.length > 0) {
      continue;
    }

    // Skip if message was not extracted by idiomi (e.g., TMS-imported)
    // Messages without the 'extracted' flag are never auto-deleted
    const isIdiomiExtracted = msg.flags?.includes('extracted');
    if (!isIdiomiExtracted) {
      continue;
    }

    // Check if any locale has a translation for this message
    // First check the current locale's own translation
    const currentHasTranslation =
      existing.locale !== defaultLocale &&
      msg.translation &&
      msg.translation.length > 0;

    // Then check other non-default locales
    const otherHasTranslation = otherLocaleCatalogs.some((catalog) => {
      // Skip if this is the default locale catalog
      if (catalog.locale === defaultLocale) {
        return false;
      }
      const otherMsg = catalog.messages.get(key);
      return (
        otherMsg && otherMsg.translation && otherMsg.translation.length > 0
      );
    });

    const hasTranslation = currentHasTranslation || otherHasTranslation;

    if (!hasTranslation) {
      keysToRemove.push(key);
    }
  }

  // Remove orphaned messages
  for (const key of keysToRemove) {
    existing.messages.delete(key);
    result.removed.push(key);
  }

  return result;
}
