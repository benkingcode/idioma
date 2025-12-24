import { promises as fs } from 'fs'
import * as gettextParser from 'gettext-parser'
import type { Catalog, Message } from './types'

// Context separator used in PO files (ASCII end-of-transmission)
const CONTEXT_SEPARATOR = '\u0004'

/**
 * Parse a PO string into a Catalog
 */
export function parsePoString(content: string, locale: string): Catalog {
  const parsed = gettextParser.po.parse(content)

  const catalog: Catalog = {
    locale,
    headers: parsed.headers || {},
    messages: new Map(),
  }

  // Process translations
  const translations = parsed.translations || {}

  for (const context of Object.keys(translations)) {
    const contextMessages = translations[context]
    if (!contextMessages) continue

    for (const msgid of Object.keys(contextMessages)) {
      // Skip the header entry (empty msgid)
      if (msgid === '') continue

      const entry = contextMessages[msgid]
      if (!entry) continue

      // Build the message key
      const key = context ? `${context}${CONTEXT_SEPARATOR}${msgid}` : msgid

      const message: Message = {
        key,
        source: msgid,
        translation: entry.msgstr?.[0] || '',
        context: context || undefined,
      }

      // Parse comments
      if (entry.comments) {
        // Extracted comments (#.)
        if (entry.comments.extracted) {
          message.comments = entry.comments.extracted.split('\n')
        }

        // Reference comments (#:)
        if (entry.comments.reference) {
          message.references = entry.comments.reference.split('\n')
        }

        // Flags (#,)
        if (entry.comments.flag) {
          message.flags = entry.comments.flag.split(',').map((f) => f.trim())
        }
      }

      catalog.messages.set(key, message)
    }
  }

  return catalog
}

/**
 * Serialize a Catalog to PO format string
 */
export function serializePoString(catalog: Catalog): string {
  // Build the translations object for gettext-parser
  const translations: Record<string, Record<string, gettextParser.GetTextTranslation>> = {}

  for (const [, message] of catalog.messages) {
    const context = message.context || ''

    if (!translations[context]) {
      translations[context] = {}
    }

    const entry: gettextParser.GetTextTranslation = {
      msgid: message.source,
      msgstr: [message.translation],
    }

    if (message.context) {
      entry.msgctxt = message.context
    }

    // Add comments if any exist
    if (message.comments || message.references || message.flags) {
      const comments: gettextParser.GetTextComment = {
        translator: '',
        reference: '',
        extracted: '',
        flag: '',
        previous: '',
      }

      if (message.comments) {
        comments.extracted = message.comments.join('\n')
      }

      if (message.references) {
        comments.reference = message.references.join('\n')
      }

      if (message.flags) {
        comments.flag = message.flags.join(', ')
      }

      entry.comments = comments
    }

    translations[context][message.source] = entry
  }

  // Add header entry
  if (!translations['']) {
    translations[''] = {}
  }
  translations[''][''] = {
    msgid: '',
    msgstr: [Object.entries(catalog.headers).map(([k, v]) => `${k}: ${v}`).join('\\n') + '\\n'],
  }

  const data: gettextParser.GetTextTranslations = {
    charset: 'utf-8',
    headers: catalog.headers,
    translations,
  }

  return gettextParser.po.compile(data).toString('utf-8')
}

/**
 * Load a PO file from disk
 */
export async function loadPoFile(path: string, locale: string): Promise<Catalog> {
  const content = await fs.readFile(path, 'utf-8')
  return parsePoString(content, locale)
}

/**
 * Write a Catalog to a PO file
 */
export async function writePoFile(path: string, catalog: Catalog): Promise<void> {
  const content = serializePoString(catalog)
  await fs.writeFile(path, content, 'utf-8')
}
