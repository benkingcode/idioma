/**
 * A single message in the catalog
 */
export interface Message {
  /** The message key (msgctxt or generated hash) */
  key: string
  /** The source message (msgid) */
  source: string
  /** The translated message (msgstr), empty if untranslated */
  translation: string
  /** Extracted comments (#.) */
  comments?: string[]
  /** Reference comments (#:) - file:line locations */
  references?: string[]
  /** Flags (#,) like fuzzy, icu-format */
  flags?: string[]
  /** Context (msgctxt) if explicitly provided */
  context?: string
}

/**
 * PO file catalog containing all messages for a locale
 */
export interface Catalog {
  /** The locale code (e.g., 'es', 'fr', 'de') */
  locale: string
  /** Headers from the PO file */
  headers: Record<string, string>
  /** Messages keyed by their msgid (or msgctxt\u0004msgid if context exists) */
  messages: Map<string, Message>
}

/**
 * Options for merging catalogs
 */
export interface MergeOptions {
  /** Remove messages that are not in the extracted set */
  clean?: boolean
  /** Mark changed source messages as fuzzy */
  markFuzzy?: boolean
}

/**
 * Result of catalog merge operation
 */
export interface MergeResult {
  /** Messages that were added */
  added: string[]
  /** Messages that were updated */
  updated: string[]
  /** Messages that were removed (if clean option used) */
  removed: string[]
  /** Messages that were marked fuzzy */
  markedFuzzy: string[]
}
