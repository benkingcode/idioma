import { promises as fs } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import * as babel from '@babel/core';
import type * as t from '@babel/types';
import { defineCommand } from 'citty';
import fg from 'fast-glob';
import { serializeJsxChildren } from '../../babel/serialize.js';
import { generateKey } from '../../keys/generator.js';
import { mergeCatalogs } from '../../po/merge.js';
import { loadPoFile, writePoFile } from '../../po/parser.js';
import type { Catalog, Message } from '../../po/types.js';
import {
  extractNextjsRoutes,
  extractTanStackRoutes,
  getTranslatableSegments,
  ROUTE_CONTEXT_PREFIX,
} from '../../routes/index.js';
import type { ExtractedRoute, Framework } from '../../routes/index.js';
import { ensureGitignore } from '../../utils/gitignore.js';
import { getIdiomiPaths, loadConfig, type IdiomiConfig } from '../config.js';
import { createSpinner } from '../ui/index.js';

export interface ExtractedMessage {
  key: string;
  source: string;
  location: string;
  /** Line number in source file (1-indexed, 0 if unavailable) */
  line: number;
  context?: string;
  /** Translator comment (extracted to PO #. comment) */
  comment?: string;
  namespace?: string;
}

export interface ExtractOptions {
  cwd: string;
  sourcePatterns: string[];
  localeDir: string;
  defaultLocale: string;
  locales?: string[];
  clean?: boolean;
  /** Absolute path to idiomi folder for robust import detection */
  idiomiDir?: string;
  /** Routing configuration for extracting localized paths */
  routing?: IdiomiConfig['routing'];
}

export interface ExtractResult {
  messages: ExtractedMessage[];
  files: number;
  /** Number of route segments extracted (when localizedPaths enabled) */
  routeSegments?: number;
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
    idiomiDir,
    routing,
  } = options;

  // Find all source files
  const files = await fg(sourcePatterns, {
    cwd,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
  });

  const messages: ExtractedMessage[] = [];

  // Extract from each file
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const relativePath = relative(cwd, file);

    const fileMessages = await extractFromFile(
      content,
      file,
      relativePath,
      idiomiDir,
    );
    messages.push(...fileMessages);
  }

  // Extract routes if localizedPaths is enabled
  let routeSegments = 0;
  if (routing?.localizedPaths) {
    const routeMessages = await extractRouteMessages(cwd, routing);
    routeSegments = routeMessages.length;
    messages.push(...routeMessages);
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

      await writePoFile(poPath, existingCatalog);
    }
  }

  return { messages, files: files.length, routeSegments };
}

/**
 * Extract messages from a single file.
 *
 * @param code - Source code content
 * @param absolutePath - Absolute file path (for resolving imports)
 * @param displayPath - Path to display in locations (relative)
 * @param idiomiDir - Optional absolute path to idiomi folder for robust import detection
 */
export async function extractFromFile(
  code: string,
  absolutePath: string,
  displayPath: string,
  idiomiDir?: string,
): Promise<ExtractedMessage[]> {
  const messages: ExtractedMessage[] = [];

  // Track bindings from idiomi imports
  const translatableBindings = new Map<
    string,
    'Trans' | 'useT' | 't' | 'createT'
  >();

  // idiomiDir is required for extraction
  if (!idiomiDir) {
    return messages;
  }

  try {
    await babel.transformAsync(code, {
      filename: absolutePath,
      presets: [
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
      plugins: [
        function extractorPlugin(): babel.PluginObj {
          return {
            visitor: {
              ImportDeclaration(path) {
                const source = path.node.source.value;

                // Check if this import is from the idiomi folder
                let isIdiomiImport = false;
                if (source.startsWith('.')) {
                  const fileDir = dirname(absolutePath);
                  const resolvedImport = resolve(fileDir, source);
                  isIdiomiImport = resolvedImport.startsWith(idiomiDir);
                }

                if (!isIdiomiImport) return;

                // Track translatable imports
                for (const specifier of path.node.specifiers) {
                  if (specifier.type !== 'ImportSpecifier') continue;

                  const imported =
                    specifier.imported.type === 'Identifier'
                      ? specifier.imported.name
                      : specifier.imported.value;
                  const local = specifier.local.name;

                  if (
                    imported === 'Trans' ||
                    imported === 'useT' ||
                    imported === 't' ||
                    imported === 'createT'
                  ) {
                    translatableBindings.set(
                      local,
                      imported as 'Trans' | 'useT' | 't' | 'createT',
                    );
                  }
                }
              },

              VariableDeclarator(path) {
                const init = path.node.init;
                const id = path.node.id;
                if (id.type !== 'Identifier') return;

                // Handle identifier aliases: const T = Trans
                if (init?.type === 'Identifier') {
                  const type = translatableBindings.get(init.name);
                  if (type) {
                    translatableBindings.set(id.name, type);
                  }
                  return;
                }

                // Handle createT() and useT() calls:
                // const t = createT('es') OR const t = useT()
                // The resulting function is tracked as a 't' binding
                if (
                  init?.type === 'CallExpression' &&
                  init.callee.type === 'Identifier'
                ) {
                  const calleeType = translatableBindings.get(init.callee.name);
                  if (calleeType === 'createT' || calleeType === 'useT') {
                    translatableBindings.set(id.name, 't');
                  }
                }
              },

              JSXElement(path) {
                const opening = path.node.openingElement;
                const elementName = opening.name;

                // Get component name
                let componentName: string | null = null;
                if (elementName.type === 'JSXIdentifier') {
                  componentName = elementName.name;
                }
                if (!componentName) return;

                // Check if this is a Trans component using binding tracking
                const isTrans =
                  translatableBindings.get(componentName) === 'Trans';
                if (!isTrans) return;

                const { id, context, comment, namespace, source } =
                  parseTransElement(path.node);
                if (!source) return;

                // Use explicit id or generate hash key from source
                const key = id || generateKey(source, context, namespace);
                const line = path.node.loc?.start.line ?? 0;

                messages.push({
                  key,
                  source,
                  location: displayPath,
                  line,
                  context,
                  comment,
                  namespace,
                });
              },

              // Extract t() calls from useT hook
              CallExpression(path) {
                const callee = path.node.callee;
                if (callee.type !== 'Identifier') return;

                // Check if this is a t function call using binding tracking
                const isT = translatableBindings.get(callee.name) === 't';

                if (!isT) return;

                const args = path.node.arguments;
                const sourceArg = args[0];

                // Only extract string literal sources
                if (!sourceArg || sourceArg.type !== 'StringLiteral') return;

                const source = sourceArg.value;
                const key = generateKey(source);
                const line = path.node.loc?.start.line ?? 0;

                messages.push({
                  key,
                  source,
                  location: displayPath,
                  line,
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
      `Warning: Could not parse ${displayPath}:`,
      (error as Error).message,
    );
  }

  return messages;
}

function parseTransElement(element: t.JSXElement): {
  id?: string;
  context?: string;
  comment?: string;
  namespace?: string;
  source?: string;
} {
  const opening = element.openingElement;
  let id: string | undefined;
  let context: string | undefined;
  let comment: string | undefined;
  let namespace: string | undefined;

  // Extract id, context, comment, and ns from props
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
    if (name === 'comment' && attr.value?.type === 'StringLiteral') {
      comment = attr.value.value;
    }
    if (name === 'ns' && attr.value?.type === 'StringLiteral') {
      namespace = attr.value.value;
    }
  }

  // Serialize children to source string using the proper serializer
  // that handles plural(), component tags, and other expressions correctly
  const { message: source } = serializeJsxChildren(element.children);

  return { id, context, comment, namespace, source };
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
      // Mark as extracted by idiomi (used to distinguish from TMS-imported messages)
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

/**
 * Detect the framework being used based on package.json dependencies.
 */
async function detectFramework(cwd: string): Promise<Framework | null> {
  try {
    const pkgPath = join(cwd, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check for TanStack Router first (more specific)
    if (allDeps['@tanstack/react-router'] || allDeps['@tanstack/router']) {
      return 'tanstack';
    }

    // Check for Next.js
    if (allDeps['next']) {
      // Determine App vs Pages router by checking for app/ directory
      const hasAppDir =
        (await directoryExists(join(cwd, 'app'))) ||
        (await directoryExists(join(cwd, 'src', 'app')));
      return hasAppDir ? 'nextjs-app' : 'nextjs-pages';
    }

    return null;
  } catch {
    return null;
  }
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Extract routes and convert to messages for PO files.
 */
async function extractRouteMessages(
  cwd: string,
  routing: NonNullable<IdiomiConfig['routing']>,
): Promise<ExtractedMessage[]> {
  const framework = await detectFramework(cwd);
  if (!framework) {
    console.warn(
      '[idiomi] Could not detect framework for route extraction. ' +
        'Skipping route extraction.',
    );
    return [];
  }

  // Extract routes based on framework
  let routes: ExtractedRoute[];
  const exclude = routing.exclude ?? ['api/**', '_next/**'];

  if (framework === 'tanstack') {
    routes = await extractTanStackRoutes({ projectRoot: cwd, exclude });
  } else {
    routes = await extractNextjsRoutes({ projectRoot: cwd, exclude });
  }

  // Convert routes to messages (one per unique translatable segment)
  const messages: ExtractedMessage[] = [];
  const seenSegments = new Set<string>();

  for (const route of routes) {
    const translatableSegments = getTranslatableSegments(route.segments);

    for (const segment of translatableSegments) {
      // Skip if we've already added this segment
      if (seenSegments.has(segment)) continue;
      seenSegments.add(segment);

      // Context is "route:{segment}" to identify as a route segment
      const context = `${ROUTE_CONTEXT_PREFIX}${segment}`;
      const key = generateKey(segment, context);

      messages.push({
        key,
        source: segment,
        location: route.source,
        line: 0, // Routes don't have line numbers
        context,
      });
    }
  }

  return messages;
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
    const { localeDir } = getIdiomiPaths(config);

    // Ensure .gitignore exists in the idiomi directory
    await ensureGitignore(config.idiomiDir);

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
        // Pass absolute idiomiDir for robust import detection
        idiomiDir: resolve(cwd, config.idiomiDir),
        // Pass routing config for route extraction
        routing: config.routing,
      });

      // Build success message
      let successMsg = `Extracted ${result.messages.length} messages from ${result.files} files`;
      if (result.routeSegments && result.routeSegments > 0) {
        successMsg += ` (including ${result.routeSegments} route segments)`;
      }
      spinner.succeed(successMsg);

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
