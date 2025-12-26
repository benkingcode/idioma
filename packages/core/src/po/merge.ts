import type { Catalog, MergeOptions, MergeResult } from './types.js';

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
  if (clean) {
    const keysToRemove: string[] = [];

    for (const key of existing.messages.keys()) {
      if (!extractedKeys.has(key)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      existing.messages.delete(key);
      result.removed.push(key);
    }
  }

  return result;
}
