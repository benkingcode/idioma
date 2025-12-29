import { dirname, relative, resolve } from 'path';
import type { NodePath, PluginObj } from '@babel/core';
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import { getChunkId } from '../compiler/chunk-id.js';
import { generateKey } from '../keys/generator.js';
import { extractTransMessage, type ExtractedMessage } from './extract-trans.js';
import { serializeJsxChildren, serializeTemplateLiteral } from './serialize.js';

/**
 * Parse a function source string into an AST expression.
 * Used for inlining compiled ICU functions (plurals, selects).
 */
function parseFunctionToAst(fnSource: string): t.Expression {
  // Wrap in parentheses to make it a valid expression statement
  const code = `(${fnSource})`;
  const ast = babelParse(code, { sourceType: 'module' });
  const stmt = ast.program.body[0];
  if (t.isExpressionStatement(stmt)) {
    return stmt.expression;
  }
  // Fallback to string literal if parsing fails
  return t.stringLiteral(fnSource);
}

/**
 * Parse an expression string into an AST expression.
 * Used for reconstructing placeholder values from serialized expressions.
 *
 * Examples:
 * - "name" → t.identifier('name')
 * - "user.name" → MemberExpression(user, name)
 * - "data.nested.value" → MemberExpression(MemberExpression(data, nested), value)
 * - "items[0]" → MemberExpression(items, 0, computed=true)
 */
function parseExpressionToAst(expr: string): t.Expression {
  // Fast path: simple identifier (e.g., "name", "_value", "$ref")
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
    return t.identifier(expr);
  }

  // Parse complex expressions (member expressions, array access, etc.)
  try {
    const code = `(${expr})`;
    const ast = babelParse(code, { sourceType: 'module' });
    const stmt = ast.program.body[0];
    if (t.isExpressionStatement(stmt)) {
      return stmt.expression;
    }
  } catch {
    // If parsing fails, fall back to identifier with warning
    console.warn(`[idiomi] Unable to parse expression: ${expr}`);
  }

  // Fallback: extract first identifier (legacy behavior for truly unparseable cases)
  const firstPart = expr.split('.')[0]?.split('[')[0] || 'undefined';
  return t.identifier(firstPart);
}

export interface IdiomiPluginOptions {
  /**
   * Plugin mode:
   * - 'inlined': Bakes all translations into the bundle (default)
   * - 'suspense': Uses dynamic imports for lazy loading (React 19+)
   */
  mode?: 'inlined' | 'suspense';
  /** Pre-compiled translations object (for inlined mode) */
  translations?: Record<
    string,
    Record<string, string | ((args: Record<string, unknown>) => string)>
  >;
  /** Callback for extracted messages (runs during transformation) */
  onExtract?: (message: ExtractedMessage) => void;
  /** All supported locales (required for suspense mode) */
  locales?: string[];
  /** Output directory path for import paths (required for suspense mode) */
  outputDir?: string;
  /** Project root for computing chunk IDs (required for suspense mode) */
  projectRoot?: string;
  /** Absolute path to idiomi folder for robust import detection */
  idiomiDir?: string;
}

interface PluginState {
  opts: IdiomiPluginOptions;
  filename: string;
  idiomiUsed: boolean;
  idiomiKeys: Set<string>;
  chunkId: string;
  /** Map of local binding names to their imported type from idiomi folder */
  translatableBindings: Map<string, 'Trans' | 'useT' | 't' | 'createT'>;
  /** Resolved absolute path to idiomi folder */
  resolvedIdiomiDir: string | null;
}

/**
 * Idiomi Babel plugin for transforming Trans components and useT hooks.
 *
 * In inlined mode (default):
 * - Transforms <Trans>...</Trans> to <__Trans __t={...} __a={...} __c={...} />
 * - Inlines pre-compiled translations into the bundle
 *
 * In suspense mode:
 * - Transforms <Trans>...</Trans> to <__TransSuspense __key={...} __chunk={...} __load={...} />
 * - Injects dynamic import loaders for lazy loading
 *
 * Extraction (via onExtract callback) runs in both modes.
 */
export default function idiomiPlugin(): PluginObj<PluginState> {
  return {
    name: 'idiomi',

    pre(file) {
      const opts = (this.opts || {}) as IdiomiPluginOptions;
      const filename = file.opts.filename || 'unknown';

      this.opts = opts;
      this.filename = filename;
      this.idiomiUsed = false;
      this.idiomiKeys = new Set();
      this.chunkId = opts.projectRoot
        ? getChunkId(filename, opts.projectRoot)
        : 'unknown';
      this.translatableBindings = new Map();
      this.resolvedIdiomiDir = opts.idiomiDir ? resolve(opts.idiomiDir) : null;
    },

    visitor: {
      Program: {
        exit(path, state) {
          const { opts, idiomiUsed, chunkId } = state;

          // Handle Suspense mode - inject chunk loaders
          if (opts.mode === 'suspense' && idiomiUsed) {
            const { locales, outputDir, projectRoot } = opts;
            if (!locales || !outputDir || !projectRoot) {
              return;
            }

            // Compute relative path from source file to chunk directory
            const sourceFileDir = dirname(state.filename);
            const absSourceDir = resolve(projectRoot, sourceFileDir);
            const absChunkDir = resolve(
              projectRoot,
              outputDir,
              '.generated',
              'chunks',
            );
            let chunkRelPath = relative(absSourceDir, absChunkDir);
            // Ensure it starts with ./ for relative imports
            if (!chunkRelPath.startsWith('.')) {
              chunkRelPath = './' + chunkRelPath;
            }

            // Inject imports for suspense runtime (__TransSuspense and __useTSuspense)
            const importDecl = t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('__TransSuspense'),
                  t.identifier('__TransSuspense'),
                ),
                t.importSpecifier(
                  t.identifier('__useTSuspense'),
                  t.identifier('__useTSuspense'),
                ),
              ],
              t.stringLiteral('@idiomi/react/runtime-suspense'),
            );

            // Inject __$idiomiChunk constant
            const chunkDecl = t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('__$idiomiChunk'),
                t.stringLiteral(chunkId),
              ),
            ]);

            // Inject __$idiomiLoad object with dynamic imports
            const loaderProps = locales.map((locale) =>
              t.objectProperty(
                t.identifier(locale),
                t.arrowFunctionExpression(
                  [],
                  t.callExpression(t.import(), [
                    t.stringLiteral(`${chunkRelPath}/${chunkId}.${locale}`),
                  ]),
                ),
              ),
            );

            const loadDecl = t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('__$idiomiLoad'),
                t.objectExpression(loaderProps),
              ),
            ]);

            // Insert at the beginning of the program
            path.unshiftContainer('body', [importDecl, chunkDecl, loadDecl]);
          }

          // Handle inlined mode - inject __Trans import
          if (opts.mode !== 'suspense' && idiomiUsed) {
            const transImport = t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('__Trans'),
                  t.identifier('__Trans'),
                ),
              ],
              t.stringLiteral('@idiomi/react'),
            );
            path.unshiftContainer('body', [transImport]);
          }
        },
      },

      /**
       * Detect imports from user's idiomi folder.
       * Tracks local names to handle aliased imports.
       * Requires idiomiDir to be configured.
       */
      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state) {
        const source = path.node.source.value;
        const { resolvedIdiomiDir } = state;

        // Skip if idiomiDir not configured
        if (!resolvedIdiomiDir) {
          return;
        }

        // Check if import resolves to idiomiDir
        let isIdiomiImport = false;
        if (source.startsWith('.')) {
          const fileDir = dirname(state.filename);
          const resolvedImport = resolve(fileDir, source);
          isIdiomiImport = resolvedImport.startsWith(resolvedIdiomiDir);
        }
        // Non-relative imports (e.g., 'some-package') won't match idiomiDir

        if (!isIdiomiImport) {
          return;
        }

        // Track all translatable imports
        for (const specifier of path.node.specifiers) {
          if (t.isImportSpecifier(specifier)) {
            const imported = t.isIdentifier(specifier.imported)
              ? specifier.imported.name
              : specifier.imported.value;
            const local = specifier.local.name;

            // Track Trans, useT, t, and createT as translatable bindings
            if (
              imported === 'Trans' ||
              imported === 'useT' ||
              imported === 't' ||
              imported === 'createT'
            ) {
              state.translatableBindings.set(
                local,
                imported as 'Trans' | 'useT' | 't' | 'createT',
              );
            }
          }
        }
      },

      /**
       * Track variable aliases (e.g., const T = Trans) and
       * derived functions (e.g., const t = createT('es')).
       */
      VariableDeclarator(path: NodePath<t.VariableDeclarator>, state) {
        const init = path.node.init;
        const id = path.node.id;
        if (!t.isIdentifier(id)) return;

        // Handle identifier aliases: const T = Trans
        if (t.isIdentifier(init)) {
          const type = state.translatableBindings.get(init.name);
          if (type) {
            state.translatableBindings.set(id.name, type);
          }
          return;
        }

        // Handle createT() and useT() calls:
        // const t = createT('es') OR const t = useT()
        // The resulting function is tracked as a 't' binding
        if (t.isCallExpression(init) && t.isIdentifier(init.callee)) {
          const calleeType = state.translatableBindings.get(init.callee.name);
          if (calleeType === 'createT' || calleeType === 'useT') {
            state.translatableBindings.set(id.name, 't');
          }
        }
      },

      /**
       * Transform t() and useT() calls.
       * In production: inlines translations as second argument.
       * In development: optionally extracts messages.
       */
      CallExpression(path: NodePath<t.CallExpression>, state) {
        const { opts, filename, translatableBindings, resolvedIdiomiDir } =
          state;
        const callee = path.node.callee;

        if (!t.isIdentifier(callee)) {
          return;
        }

        // Skip if idiomiDir not configured
        if (!resolvedIdiomiDir) {
          return;
        }

        const calleeName = callee.name;
        const bindingType = translatableBindings.get(calleeName);

        // Handle useT() calls in suspense mode
        if (bindingType === 'useT' && opts.mode === 'suspense') {
          // Mark that idiomi is used (triggers chunk/loader injection)
          state.idiomiUsed = true;

          // Transform: useT() → __useTSuspense(__$idiomiChunk, __$idiomiLoad)
          path.replaceWith(
            t.callExpression(t.identifier('__useTSuspense'), [
              t.identifier('__$idiomiChunk'),
              t.identifier('__$idiomiLoad'),
            ]),
          );
          return;
        }

        // Check if this is a t() call from idiomi
        if (bindingType !== 't') {
          return;
        }

        // Get the first argument (source string or template literal)
        const args = path.node.arguments;
        const sourceArg = args[0];

        // Handle template literals with plural() calls
        if (t.isTemplateLiteral(sourceArg)) {
          const serialized = serializeTemplateLiteral(sourceArg);
          const source = serialized.message;
          const key = generateKey(source);

          // Extract message if callback provided
          if (opts.onExtract) {
            const line = path.node.loc?.start.line || 0;
            opts.onExtract({
              key,
              source,
              context: undefined,
              placeholders: serialized.placeholders,
              components: [],
              references: [`${filename}:${line}`],
            });
          }

          // Template literals are handled at runtime (no inlining)
          return;
        }

        // Dynamic strings can't be inlined - left unchanged for runtime
        if (!t.isStringLiteral(sourceArg)) {
          return;
        }

        const source = sourceArg.value;
        const key = generateKey(source);

        // Extract message if callback provided
        if (opts.onExtract) {
          const line = path.node.loc?.start.line || 0;
          opts.onExtract({
            key,
            source,
            context: undefined,
            placeholders: {},
            components: [],
            references: [`${filename}:${line}`],
          });
        }

        // Inline translations
        const translations = opts.translations || {};
        const localeMessages = translations[key];

        // If no translations found, leave unchanged
        if (!localeMessages) {
          return;
        }

        // Build the inlined translations object: { [key]: { en: '...', es: '...' } }
        const translationEntries = Object.entries(localeMessages).map(
          ([locale, msg]) =>
            t.objectProperty(
              t.stringLiteral(locale),
              typeof msg === 'string'
                ? t.stringLiteral(msg)
                : parseFunctionToAst(String(msg)),
            ),
        );

        const inlinedObject = t.objectExpression([
          t.objectProperty(
            t.stringLiteral(key),
            t.objectExpression(translationEntries),
          ),
        ]);

        // Check if there's already a second argument (values)
        const existingSecondArg = args[1];
        if (existingSecondArg) {
          // If second arg exists and is an object (values), shift it to third position
          // t('source', { values }) -> t('source', { inlined }, { values })
          args[1] = inlinedObject;
          if (
            !t.isNullLiteral(existingSecondArg) &&
            !t.isIdentifier(existingSecondArg, { name: 'undefined' })
          ) {
            // Only keep values if it's not null/undefined
            args[2] = existingSecondArg;
          }
        } else {
          // No values, just add inlined object
          args.push(inlinedObject);
        }
      },

      JSXElement(path: NodePath<t.JSXElement>, state) {
        const { opts, filename, translatableBindings, resolvedIdiomiDir } =
          state;

        // Skip if idiomiDir not configured
        if (!resolvedIdiomiDir) {
          return;
        }

        // Check if this is a Trans component
        const opening = path.node.openingElement;
        const elementName = opening.name;

        // Get the component name to check
        let componentName: string | null = null;
        if (t.isJSXIdentifier(elementName)) {
          componentName = elementName.name;
        } else if (t.isJSXMemberExpression(elementName)) {
          // For member expressions like Idiomi.Trans, check the property
          if (t.isJSXIdentifier(elementName.property)) {
            componentName = elementName.property.name;
          }
        }

        if (!componentName) {
          return;
        }

        // Check if this is a Trans component using binding tracking
        const isTrans = translatableBindings.get(componentName) === 'Trans';
        if (!isTrans) {
          return;
        }

        // Extract the message (skip name check since we verified via binding tracking)
        const extracted = extractTransMessage(path, filename, true);

        // Call extraction callback if provided
        if (extracted && opts.onExtract) {
          opts.onExtract(extracted);
        }

        // Skip transformation if no message extracted (key-only Trans or empty)
        if (!extracted) {
          return;
        }

        // Mark that idiomi was used in this file
        state.idiomiUsed = true;
        state.idiomiKeys.add(extracted.key);

        // Transform based on mode
        if (opts.mode === 'suspense') {
          transformTransSuspense(path, extracted);
        } else {
          transformTransComponent(path, extracted, opts.translations || {});
        }
      },
    },
  };
}

/**
 * Build common props (__ns, __a, __c) shared by both Trans and TransSuspense transforms.
 * Extracts the duplicated logic for namespace, placeholders, and components.
 */
function buildCommonTransProps(extracted: ExtractedMessage): t.JSXAttribute[] {
  const { placeholders, components, namespace } = extracted;
  const props: t.JSXAttribute[] = [];

  // Add __ns if there is a namespace
  if (namespace) {
    props.push(
      t.jsxAttribute(t.jsxIdentifier('__ns'), t.stringLiteral(namespace)),
    );
  }

  // Add __a if there are placeholders
  if (Object.keys(placeholders).length > 0) {
    const aEntries: t.ObjectProperty[] = [];
    for (const [name, expr] of Object.entries(placeholders)) {
      // Parse expression string to AST (handles identifiers, member expressions, array access)
      aEntries.push(
        t.objectProperty(t.stringLiteral(name), parseExpressionToAst(expr)),
      );
    }

    props.push(
      t.jsxAttribute(
        t.jsxIdentifier('__a'),
        t.jsxExpressionContainer(t.objectExpression(aEntries)),
      ),
    );
  }

  // Add __c (component array) and __cn (component names) if there are components
  if (components.length > 0) {
    const componentElements = components.map((name) => t.identifier(name));
    const componentNameStrings = components.map((name) =>
      t.stringLiteral(name),
    );

    // __c: array of component references
    props.push(
      t.jsxAttribute(
        t.jsxIdentifier('__c'),
        t.jsxExpressionContainer(t.arrayExpression(componentElements)),
      ),
    );

    // __cn: array of component name strings (for named tag matching)
    props.push(
      t.jsxAttribute(
        t.jsxIdentifier('__cn'),
        t.jsxExpressionContainer(t.arrayExpression(componentNameStrings)),
      ),
    );
  }

  return props;
}

/**
 * Transform a Trans component to __Trans with translation props
 */
function transformTransComponent(
  path: NodePath<t.JSXElement>,
  extracted: ExtractedMessage,
  translations: Record<
    string,
    Record<string, string | ((args: Record<string, unknown>) => string)>
  >,
): void {
  const { key, source, placeholders, components, namespace } = extracted;

  // Get translations for this message using the key (hash or explicit id)
  let messageTranslations: Record<
    string,
    string | ((args: Record<string, unknown>) => string)
  > = {};
  if (namespace) {
    const nsTranslations = (
      translations as unknown as {
        __ns?: Record<
          string,
          Record<
            string,
            Record<string, string | ((args: Record<string, unknown>) => string)>
          >
        >;
      }
    ).__ns;
    messageTranslations = nsTranslations?.[namespace]?.[key] || {};
  } else {
    messageTranslations = translations[key] || {};
  }

  // Build the __t prop (translations object)
  const tEntries: t.ObjectProperty[] = [];
  for (const [locale, translation] of Object.entries(messageTranslations)) {
    if (typeof translation === 'string') {
      tEntries.push(
        t.objectProperty(t.stringLiteral(locale), t.stringLiteral(translation)),
      );
    } else {
      // Function translations - parse the function source to AST
      tEntries.push(
        t.objectProperty(
          t.stringLiteral(locale),
          parseFunctionToAst(String(translation)),
        ),
      );
    }
  }

  // Add source as fallback under a special key
  if (!messageTranslations['__source']) {
    tEntries.push(
      t.objectProperty(t.stringLiteral('__source'), t.stringLiteral(source)),
    );
  }

  // Build props array: __t (translations) + common props (__ns, __a, __c)
  const props: t.JSXAttribute[] = [
    // __t: translations object
    t.jsxAttribute(
      t.jsxIdentifier('__t'),
      t.jsxExpressionContainer(t.objectExpression(tEntries)),
    ),
    // Add common props (__ns, __a, __c)
    ...buildCommonTransProps(extracted),
  ];

  // Create the new __Trans element
  const newElement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('__Trans'), props, true),
    null,
    [],
    true,
  );

  path.replaceWith(newElement);
}

/**
 * Transform a Trans component to __TransSuspense for Suspense mode
 */
function transformTransSuspense(
  path: NodePath<t.JSXElement>,
  extracted: ExtractedMessage,
): void {
  const { key } = extracted;

  // Build props array: suspense props (__key, __chunk, __load) + common props (__ns, __a, __c)
  const props: t.JSXAttribute[] = [
    // __key: translation key
    t.jsxAttribute(t.jsxIdentifier('__key'), t.stringLiteral(key)),
    // __chunk: reference to injected chunk ID
    t.jsxAttribute(
      t.jsxIdentifier('__chunk'),
      t.jsxExpressionContainer(t.identifier('__$idiomiChunk')),
    ),
    // __load: reference to injected loader object
    t.jsxAttribute(
      t.jsxIdentifier('__load'),
      t.jsxExpressionContainer(t.identifier('__$idiomiLoad')),
    ),
    // Add common props (__ns, __a, __c)
    ...buildCommonTransProps(extracted),
  ];

  // Create the new __TransSuspense element
  const newElement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('__TransSuspense'), props, true),
    null,
    [],
    true,
  );

  path.replaceWith(newElement);
}
