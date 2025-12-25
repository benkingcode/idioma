import { promises as fs } from 'fs';
import { join, relative } from 'path';
import * as babel from '@babel/core';
import type * as t from '@babel/types';
import { defineCommand } from 'citty';
import { glob } from 'fast-glob';
import { mergeCatalogs } from '../../po/merge';
import { loadPoFile, writePoFile } from '../../po/parser';
import type { Catalog, Message } from '../../po/types';
import { ensureGitignore } from '../../utils/gitignore';
import { getIdiomaPaths, loadConfig } from '../config';

export interface ExtractedMessage {
  key: string;
  source: string;
  location: string;
  context?: string;
  namespace?: string;
}

export interface ExtractOptions {
  cwd: string;
  sourcePatterns: string[];
  localeDir: string;
  defaultLocale: string;
  locales?: string[];
  clean?: boolean;
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
  const { cwd, sourcePatterns, localeDir, defaultLocale, locales, clean } =
    options;

  // Find all source files
  const files = await glob(sourcePatterns, {
    cwd,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
  });

  const messages: ExtractedMessage[] = [];

  // Extract from each file
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const relativePath = relative(cwd, file);

    const fileMessages = await extractFromFile(content, relativePath);
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
      const extractedCatalog = messagesToCatalog(nsMessages, locale, namespace);

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

      // For the default locale, copy source to translation if empty
      if (locale === defaultLocale) {
        for (const [, msg] of existingCatalog.messages) {
          if (!msg.translation) {
            msg.translation = msg.source;
          }
        }
      }

      await writePoFile(poPath, existingCatalog);
    }
  }

  return { messages, files: files.length };
}

/**
 * Extract messages from a single file.
 */
async function extractFromFile(
  code: string,
  filename: string,
): Promise<ExtractedMessage[]> {
  const messages: ExtractedMessage[] = [];

  try {
    await babel.transformAsync(code, {
      filename,
      presets: [
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
      plugins: [
        function extractorPlugin(): babel.PluginObj {
          return {
            visitor: {
              JSXElement(path) {
                const opening = path.node.openingElement;
                if (!isTransComponent(opening)) return;

                const { id, context, namespace, source } = parseTransElement(
                  path.node,
                );
                if (!source) return;

                // Use source as key (matches PO format) or explicit id
                // The generateKey is for compile-time optimization
                const key = id || source;
                const line = path.node.loc?.start.line ?? 1;

                messages.push({
                  key,
                  source,
                  location: `${filename}:${line}`,
                  context,
                  namespace,
                });
              },
            },
          };
        },
      ],
    });
  } catch (error) {
    // Silently skip files with parse errors
    console.warn(
      `Warning: Could not parse ${filename}:`,
      (error as Error).message,
    );
  }

  return messages;
}

function isTransComponent(opening: t.JSXOpeningElement): boolean {
  if (opening.name.type !== 'JSXIdentifier') return false;
  return opening.name.name === 'Trans';
}

function parseTransElement(element: t.JSXElement): {
  id?: string;
  context?: string;
  namespace?: string;
  source?: string;
} {
  const opening = element.openingElement;
  let id: string | undefined;
  let context: string | undefined;
  let namespace: string | undefined;

  // Extract id, context, and ns from props
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute') continue;
    if (attr.name.type !== 'JSXIdentifier') continue;

    const name = attr.name.name;
    if (name === 'id' && attr.value?.type === 'StringLiteral') {
      id = attr.value.value;
    }
    if (name === 'context' && attr.value?.type === 'StringLiteral') {
      context = attr.value.value;
    }
    if (name === 'ns' && attr.value?.type === 'StringLiteral') {
      namespace = attr.value.value;
    }
  }

  // Serialize children to source string
  const source = serializeChildren(element.children);

  return { id, context, namespace, source };
}

function serializeChildren(children: t.JSXElement['children']): string {
  let result = '';
  let tagIndex = 0;
  let exprIndex = 0;

  for (const child of children) {
    if (child.type === 'JSXText') {
      // Normalize whitespace but preserve intentional spacing
      const text = child.value.replace(/\s+/g, ' ');
      result += text;
    } else if (child.type === 'JSXExpressionContainer') {
      if (child.expression.type === 'JSXEmptyExpression') continue;

      if (child.expression.type === 'Identifier') {
        result += `{${child.expression.name}}`;
      } else if (child.expression.type === 'MemberExpression') {
        result += `{${serializeMemberExpression(child.expression)}}`;
      } else {
        result += `{${exprIndex++}}`;
      }
    } else if (child.type === 'JSXElement') {
      const innerContent = serializeChildren(child.children);
      result += `<${tagIndex}>${innerContent}</${tagIndex}>`;
      tagIndex++;
    }
  }

  return result.trim();
}

function serializeMemberExpression(expr: t.MemberExpression): string {
  let result = '';
  if (expr.object.type === 'Identifier') {
    result = expr.object.name;
  } else if (expr.object.type === 'MemberExpression') {
    result = serializeMemberExpression(expr.object);
  }

  if (expr.property.type === 'Identifier') {
    result += `.${expr.property.name}`;
  }

  return result;
}

function messagesToCatalog(
  messages: ExtractedMessage[],
  locale: string,
  namespace?: string,
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
      source: msg.source,
      translation: '',
      references: [msg.location],
      context: msg.context,
      namespace: msg.namespace,
    };

    // If message with same key exists, merge references
    const existing = catalog.messages.get(msg.key);
    if (existing) {
      existing.references = [...(existing.references ?? []), msg.location];
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

    const result = await extractMessages({
      cwd,
      sourcePatterns: config.sourcePatterns ?? ['**/*.tsx', '**/*.jsx'],
      localeDir,
      defaultLocale: config.defaultLocale,
      locales: config.locales,
      clean: args.clean,
    });

    console.log(
      `Extracted ${result.messages.length} messages from ${result.files} files`,
    );

    if (args.watch) {
      console.log('Watching for changes...');
      // Watch mode would be implemented with chokidar
    }
  },
});
