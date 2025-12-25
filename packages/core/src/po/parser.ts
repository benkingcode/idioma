import { promises as fs } from 'fs';
import { basename, join } from 'path';
import * as gettextParser from 'gettext-parser';
import type { Catalog, Message } from './types.js';

// Context separator used in PO files (ASCII end-of-transmission)
const CONTEXT_SEPARATOR = '\u0004';

/**
 * Parse a PO string into a Catalog
 */
export function parsePoString(content: string, locale: string): Catalog {
  const parsed = gettextParser.po.parse(content);

  const catalog: Catalog = {
    locale,
    headers: parsed.headers || {},
    messages: new Map(),
  };

  // Process translations
  const translations = parsed.translations || {};

  for (const context of Object.keys(translations)) {
    const contextMessages = translations[context];
    if (!contextMessages) continue;

    for (const msgid of Object.keys(contextMessages)) {
      // Skip the header entry (empty msgid)
      if (msgid === '') continue;

      const entry = contextMessages[msgid];
      if (!entry) continue;

      // Build the message key
      const key = context ? `${context}${CONTEXT_SEPARATOR}${msgid}` : msgid;

      const message: Message = {
        key,
        source: msgid,
        translation: entry.msgstr?.[0] || '',
        context: context || undefined,
      };

      // Parse comments
      if (entry.comments) {
        // Extracted comments (#.)
        if (entry.comments.extracted) {
          message.comments = entry.comments.extracted.split('\n');
        }

        // Reference comments (#:)
        if (entry.comments.reference) {
          message.references = entry.comments.reference.split('\n');
        }

        // Flags (#,)
        if (entry.comments.flag) {
          message.flags = entry.comments.flag.split(',').map((f) => f.trim());
        }
      }

      catalog.messages.set(key, message);
    }
  }

  return catalog;
}

/**
 * Serialize a Catalog to PO format string
 */
export function serializePoString(catalog: Catalog): string {
  // Build the translations object for gettext-parser
  const translations: Record<
    string,
    Record<string, gettextParser.GetTextTranslation>
  > = {};

  for (const [, message] of catalog.messages) {
    const context = message.context || '';

    if (!translations[context]) {
      translations[context] = {};
    }

    const entry: gettextParser.GetTextTranslation = {
      msgid: message.source,
      msgstr: [message.translation],
    };

    if (message.context) {
      entry.msgctxt = message.context;
    }

    // Add comments if any exist
    if (message.comments || message.references || message.flags) {
      const comments: gettextParser.GetTextComment = {
        translator: '',
        reference: '',
        extracted: '',
        flag: '',
        previous: '',
      };

      if (message.comments) {
        comments.extracted = message.comments.join('\n');
      }

      if (message.references) {
        comments.reference = message.references.join('\n');
      }

      if (message.flags) {
        comments.flag = message.flags.join(', ');
      }

      entry.comments = comments;
    }

    translations[context][message.source] = entry;
  }

  // Add header entry
  if (!translations['']) {
    translations[''] = {};
  }
  translations[''][''] = {
    msgid: '',
    msgstr: [
      Object.entries(catalog.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\\n') + '\\n',
    ],
  };

  const data: gettextParser.GetTextTranslations = {
    charset: 'utf-8',
    headers: catalog.headers,
    translations,
  };

  return gettextParser.po.compile(data).toString('utf-8');
}

/**
 * Load a PO file from disk
 */
export async function loadPoFile(
  path: string,
  locale: string,
): Promise<Catalog> {
  const content = await fs.readFile(path, 'utf-8');
  return parsePoString(content, locale);
}

/**
 * Write a Catalog to a PO file
 */
export async function writePoFile(
  path: string,
  catalog: Catalog,
): Promise<void> {
  const content = serializePoString(catalog);
  await fs.writeFile(path, content, 'utf-8');
}

/**
 * Load all catalogs for a locale, supporting both flat and namespaced structures.
 *
 * Flat structure: locales/{locale}.po
 * Namespaced structure: locales/{locale}/{namespace}.po
 * Hybrid: both flat file and namespace directory can coexist
 *
 * @param localeDir - The base locale directory (e.g., "locales")
 * @param locale - The locale code (e.g., "en", "es")
 * @returns Map from namespace (or undefined for flat) to Catalog
 */
export async function loadLocaleCatalogs(
  localeDir: string,
  locale: string,
): Promise<Map<string | undefined, Catalog>> {
  const catalogs = new Map<string | undefined, Catalog>();

  // Check for flat file: locales/{locale}.po
  const flatPath = join(localeDir, `${locale}.po`);
  try {
    const stat = await fs.stat(flatPath);
    if (stat.isFile()) {
      const content = await fs.readFile(flatPath, 'utf-8');
      const catalog = parsePoString(content, locale);
      catalog.namespace = undefined;
      catalogs.set(undefined, catalog);
    }
  } catch {
    // File doesn't exist, that's fine
  }

  // Check for namespace directory: locales/{locale}/
  const nsDir = join(localeDir, locale);
  try {
    const stat = await fs.stat(nsDir);
    if (stat.isDirectory()) {
      const files = await fs.readdir(nsDir);
      for (const file of files) {
        if (file.endsWith('.po')) {
          const namespace = basename(file, '.po');
          const filePath = join(nsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const catalog = parsePoString(content, locale);
          catalog.namespace = namespace;
          catalogs.set(namespace, catalog);
        }
      }
    }
  } catch {
    // Directory doesn't exist, that's fine
  }

  return catalogs;
}
