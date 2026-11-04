import { promises as fs } from 'fs';
import { join, relative, resolve } from 'path';
import { defineCommand } from 'citty';
import fg from 'fast-glob';
import { extractModule, type CatalogueMessage } from '../../oxc/extract.js';
import { mergeCatalogs } from '../../po/merge.js';
import { loadPoFile, writePoFile } from '../../po/parser.js';
import type { Catalog, Message, PoFormatOptions } from '../../po/types.js';
import { ensureGitignore } from '../../utils/gitignore.js';
import {
  loadPathsMatcher,
  type PathsMatcher,
} from '../../utils/resolve-tsconfig-paths.js';
import { getIdiomaPaths, loadConfig } from '../config.js';
import { createSpinner } from '../ui/index.js';

/** A message as `idioma extract` writes it to the catalogue. */
export type ExtractedMessage = CatalogueMessage;

export interface ExtractOptions {
  cwd: string;
  sourcePatterns: string[];
  localeDir: string;
  defaultLocale: string;
  locales?: string[];
  clean?: boolean;
  /** Absolute path to idioma folder for robust import detection */
  idiomaDir?: string;
  /** Matcher for resolving TypeScript path aliases to file paths */
  pathsMatcher?: PathsMatcher;
  /** How PO files are written (e.g. line folding) */
  po?: PoFormatOptions;
}

export interface ExtractResult {
  messages: ExtractedMessage[];
  files: number;
}

/**
 * Extract messages from source files.
 */
export async function extractMessages(
  options: ExtractOptions,
): Promise<ExtractResult> {
  const {
    cwd,
    sourcePatterns,
    localeDir,
    defaultLocale,
    locales,
    clean,
    idiomaDir,
    pathsMatcher,
    po,
  } = options;

  // Find all source files. Sorted because fast-glob's order is not stable, and
  // references are added in the order files are visited: unsorted, a key used
  // in two files got its #: lines in a different order from run to run, so a
  // no-op extract rewrote the catalogues (issue #12).
  const files = (
    await fg(sourcePatterns, {
      cwd,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    })
  ).sort();

  const messages: ExtractedMessage[] = [];

  // Extract from each file
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const relativePath = relative(cwd, file);

    const fileMessages = await extractFromFile(
      content,
      file,
      relativePath,
      idiomaDir,
      pathsMatcher,
    );
    messages.push(...fileMessages);
  }

  // Ensure locale directory exists
  await fs.mkdir(localeDir, { recursive: true });

  // Group messages by namespace (undefined for non-namespaced)
  const messagesByNamespace = new Map<string | undefined, ExtractedMessage[]>();
  for (const msg of messages) {
    const ns = msg.namespace;
    if (!messagesByNamespace.has(ns)) {
      messagesByNamespace.set(ns, []);
    }
    messagesByNamespace.get(ns)!.push(msg);
  }

  // Get all locales to update
  const allLocales = locales ?? [defaultLocale];
  if (!allLocales.includes(defaultLocale)) {
    allLocales.unshift(defaultLocale);
  }

  // Update PO files for each locale and namespace
  for (const locale of allLocales) {
    for (const [namespace, nsMessages] of messagesByNamespace) {
      // Determine the path based on namespace
      let poPath: string;
      if (namespace === undefined) {
        // Non-namespaced: locales/{locale}.po
        poPath = join(localeDir, `${locale}.po`);
      } else {
        // Namespaced: locales/{locale}/{namespace}.po
        const nsDir = join(localeDir, locale);
        await fs.mkdir(nsDir, { recursive: true });
        poPath = join(nsDir, `${namespace}.po`);
      }

      // Convert messages to catalog
      const extractedCatalog = messagesToCatalog(
        nsMessages,
        locale,
        namespace,
        defaultLocale,
      );

      let existingCatalog: Catalog;
      try {
        existingCatalog = await loadPoFile(poPath, locale);
        existingCatalog.namespace = namespace;
      } catch {
        // No existing file, create empty catalog
        existingCatalog = {
          locale,
          namespace,
          messages: new Map(),
          headers: {
            Language: locale,
          },
        };
      }

      // Merge extracted with existing (modifies existingCatalog in-place)
      mergeCatalogs(existingCatalog, extractedCatalog, {
        clean: clean ?? false,
      });

      await writePoFile(poPath, existingCatalog, po);
    }
  }

  return { messages, files: files.length };
}

/**
 * Extract messages from a single file.
 *
 * @param code - Source code content
 * @param absolutePath - Absolute file path (for resolving imports)
 * @param displayPath - Path to display in locations (relative)
 * @param idiomaDir - Optional absolute path to idioma folder for robust import detection
 */
export async function extractFromFile(
  code: string,
  absolutePath: string,
  displayPath: string,
  idiomaDir?: string,
  pathsMatcher?: PathsMatcher,
): Promise<ExtractedMessage[]> {
  try {
    return extractModule(code, absolutePath, {
      displayPath,
      idiomaDir,
      pathsMatcher,
    });
  } catch (error) {
    // Silently skip files with parse errors
    console.warn(
      `Warning: Could not parse ${displayPath}:`,
      (error as Error).message,
    );
    return [];
  }
}

export function messagesToCatalog(
  messages: ExtractedMessage[],
  locale: string,
  namespace: string | undefined,
  defaultLocale: string,
): Catalog {
  const catalog: Catalog = {
    locale,
    namespace,
    messages: new Map(),
    headers: {
      Language: locale,
    },
  };

  for (const msg of messages) {
    const message: Message = {
      key: msg.key,
      source: msg.key, // msgid = key (hash or explicit id)
      // Default locale gets source text as fallback; other locales start empty
      translation: locale === defaultLocale ? msg.source : '',
      references: [msg.location],
      context: msg.context,
      namespace: msg.namespace,
      // Convert comment prop to PO extracted comment
      comments: msg.comment ? [msg.comment] : undefined,
      // Mark as extracted by idioma (used to distinguish from TMS-imported messages)
      flags: ['extracted'],
    };

    // If message with same key exists, merge references (deduplicated)
    const existing = catalog.messages.get(msg.key);
    if (existing) {
      // Only add if not already present (same file)
      if (!existing.references?.includes(msg.location)) {
        existing.references = [...(existing.references ?? []), msg.location];
      }
    } else {
      catalog.messages.set(msg.key, message);
    }
  }

  return catalog;
}

export const extractCommand = defineCommand({
  meta: {
    name: 'extract',
    description: 'Extract messages from source files',
  },
  args: {
    clean: {
      type: 'boolean',
      description: 'Remove unused messages',
      default: false,
    },
    watch: {
      type: 'boolean',
      description: 'Watch for changes',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const { localeDir } = getIdiomaPaths(config);

    // Ensure .gitignore exists in the idioma directory
    await ensureGitignore(config.idiomaDir);

    // Load TypeScript path aliases for resolving non-relative imports
    const pathsMatcher = loadPathsMatcher(cwd);

    const spinner = createSpinner();
    spinner.start('Extracting messages...');

    try {
      const result = await extractMessages({
        cwd,
        sourcePatterns: config.sourcePatterns ?? ['**/*.tsx', '**/*.jsx'],
        localeDir,
        defaultLocale: config.defaultLocale,
        locales: config.locales,
        clean: args.clean,
        // Pass absolute idiomaDir for robust import detection
        idiomaDir: resolve(cwd, config.idiomaDir),
        pathsMatcher: pathsMatcher ?? undefined,
        po: config.po,
      });

      spinner.succeed(
        `Extracted ${result.messages.length} messages from ${result.files} files`,
      );

      if (args.watch) {
        console.log('Watching for changes...');
        // Watch mode would be implemented with chokidar
      }
    } catch (error) {
      spinner.fail('Extraction failed');
      throw error;
    }
  },
});
