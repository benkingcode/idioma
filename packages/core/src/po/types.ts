/**
 * A single message in the catalog
 */
export interface Message {
  /** The message key (msgctxt or generated hash) */
  key: string;
  /** The source message (msgid) */
  source: string;
  /** The translated message (msgstr), empty if untranslated */
  translation: string;
  /** Extracted comments (#.) */
  comments?: string[];
  /** Reference comments (#:) - file:line locations */
  references?: string[];
  /** Flags (#,) like fuzzy, icu-format */
  flags?: string[];
  /** Context (msgctxt) if explicitly provided */
  context?: string;
  /** Namespace for organizing translations */
  namespace?: string;
}

/**
 * PO file catalog containing all messages for a locale
 */
export interface Catalog {
  /** The locale code (e.g., 'es', 'fr', 'de') */
  locale: string;
  /** The namespace this catalog belongs to (undefined for non-namespaced) */
  namespace?: string;
  /** Headers from the PO file */
  headers: Record<string, string>;
  /** Messages keyed by their msgid (or msgctxt\u0004msgid if context exists) */
  messages: Map<string, Message>;
}

/**
 * Options for merging catalogs
 */
export interface MergeOptions {
  /** Remove messages that are not in the extracted set */
  clean?: boolean;
  /** Mark changed source messages as fuzzy */
  markFuzzy?: boolean;
}

/**
 * Result of catalog merge operation
 */
export interface MergeResult {
  /** Messages that were added */
  added: string[];
  /** Messages that were updated */
  updated: string[];
  /** Messages that were removed (if clean option used) */
  removed: string[];
  /** Messages that were marked fuzzy */
  markedFuzzy: string[];
}

/**
 * Options for incremental single-file merge
 */
export interface IncrementalMergeOptions {
  /** The file path being extracted (e.g., "src/App.tsx") - file only, no line numbers */
  filePath: string;
  /** The default locale (used to determine if translations exist) */
  defaultLocale: string;
  /** Other locale catalogs to check for translations before removing orphans */
  otherLocaleCatalogs?: Catalog[];
}

/**
 * Result of incremental merge operation
 */
export interface IncrementalMergeResult {
  /** Messages that were added */
  added: string[];
  /** Messages that were updated (references changed) */
  updated: string[];
  /** Messages that were removed (orphaned with no translations) */
  removed: string[];
}
