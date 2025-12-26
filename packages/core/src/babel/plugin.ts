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
    console.warn(`[idioma] Unable to parse expression: ${expr}`);
  }

  // Fallback: extract first identifier (legacy behavior for truly unparseable cases)
  const firstPart = expr.split('.')[0]?.split('[')[0] || 'undefined';
  return t.identifier(firstPart);
}

export interface IdiomaPluginOptions {
  /** Plugin mode: 'development' or 'production' */
  mode?: 'development' | 'production';
  /** Pre-compiled translations object (for production, inlined mode) */
  translations?: Record<
    string,
    Record<string, string | ((args: Record<string, unknown>) => string)>
  >;
  /** Callback for extracted messages (for extraction phase) */
  onExtract?: (message: ExtractedMessage) => void;
  /** Enable Suspense mode with dynamic imports */
  useSuspense?: boolean;
  /** All supported locales (required for suspense mode) */
  locales?: string[];
  /** Output directory path for import paths (required for suspense mode) */
  outputDir?: string;
  /** Project root for computing chunk IDs (required for suspense mode) */
  projectRoot?: string;
  /** Absolute path to idioma folder for robust import detection */
  idiomaDir?: string;
}

interface PluginState {
  opts: IdiomaPluginOptions;
  filename: string;
  idiomaUsed: boolean;
  idiomaKeys: Set<string>;
  chunkId: string;
  /** Whether this file has dynamic t() calls (non-literal first arg) */
  hasDynamicT: boolean;
  /** Paths to createT() calls that need translations injected */
  createTCalls: NodePath<t.CallExpression>[];
  /** Map of local binding names to their imported type from idioma folder */
  translatableBindings: Map<string, 'Trans' | 'useT' | 't'>;
  /** Resolved absolute path to idioma folder */
  resolvedIdiomaDir: string | null;
  /** Local name of createT import (for tracking t functions derived from it) */
  createTImportName: string | null;
  /** Set of variable names that hold t functions from createT() */
  createTDerivedFunctions: Set<string>;
}

/**
 * Idioma Babel plugin for transforming Trans components and useT hooks.
 *
 * In development mode:
 * - Leaves code unchanged
 * - Optionally extracts messages via onExtract callback
 *
 * In production mode (inlined):
 * - Transforms <Trans>...</Trans> to <__Trans __t={...} __a={...} __c={...} />
 * - Inlines pre-compiled translations
 *
 * In production mode (suspense):
 * - Transforms <Trans>...</Trans> to <__TransSuspense __key={...} __chunk={...} __load={...} />
 * - Injects dynamic import loaders
 */
export default function idiomaPlugin(): PluginObj<PluginState> {
  return {
    name: 'idioma',

    pre(file) {
      const opts = (this.opts || {}) as IdiomaPluginOptions;
      const filename = file.opts.filename || 'unknown';

      this.opts = opts;
      this.filename = filename;
      this.idiomaUsed = false;
      this.idiomaKeys = new Set();
      this.chunkId = opts.projectRoot
        ? getChunkId(filename, opts.projectRoot)
        : 'unknown';
      this.hasDynamicT = false;
      this.createTCalls = [];
      this.translatableBindings = new Map();
      this.resolvedIdiomaDir = opts.idiomaDir ? resolve(opts.idiomaDir) : null;
    },

    visitor: {
      Program: {
        exit(path, state) {
          const { opts, idiomaUsed, chunkId, hasDynamicT, createTCalls } =
            state;

          // Handle dynamic t() calls - inject translations for runtime lookup
          if (
            opts.mode === 'production' &&
            hasDynamicT &&
            createTCalls.length > 0 &&
            opts.outputDir
          ) {
            // Inject: import { translations as __$translations } from '{outputDir}/.generated/translations'
            const translationsImport = t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('__$translations'),
                  t.identifier('translations'),
                ),
              ],
              t.stringLiteral(`${opts.outputDir}/.generated/translations`),
            );
            path.unshiftContainer('body', [translationsImport]);

            // Modify all createT(locale) calls to createT(locale, __$translations)
            for (const callPath of createTCalls) {
              const args = callPath.node.arguments;
              // Only add if not already provided
              if (args.length === 1) {
                args.push(t.identifier('__$translations'));
              }
            }
          }

          // Handle Suspense mode - inject chunk loaders
          if (opts.mode === 'production' && opts.useSuspense && idiomaUsed) {
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
              t.stringLiteral('@idioma/react/runtime-suspense'),
            );

            // Inject __$idiomaChunk constant
            const chunkDecl = t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('__$idiomaChunk'),
                t.stringLiteral(chunkId),
              ),
            ]);

            // Inject __$idiomaLoad object with dynamic imports
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
                t.identifier('__$idiomaLoad'),
                t.objectExpression(loaderProps),
              ),
            ]);

            // Insert at the beginning of the program
            path.unshiftContainer('body', [importDecl, chunkDecl, loadDecl]);
          }

          // Handle non-Suspense production mode - inject __Trans import
          if (opts.mode === 'production' && !opts.useSuspense && idiomaUsed) {
            const transImport = t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('__Trans'),
                  t.identifier('__Trans'),
                ),
              ],
              t.stringLiteral('@idioma/react'),
            );
            path.unshiftContainer('body', [transImport]);
          }
        },
      },

      /**
       * Detect imports from user's idioma folder.
       * Tracks local names to handle aliased imports.
       * Requires idiomaDir to be configured.
       */
      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state) {
        const source = path.node.source.value;
        const { resolvedIdiomaDir } = state;

        // Skip if idiomaDir not configured
        if (!resolvedIdiomaDir) {
          return;
        }

        // Check if import resolves to idiomaDir
        let isIdiomaImport = false;
        if (source.startsWith('.')) {
          const fileDir = dirname(state.filename);
          const resolvedImport = resolve(fileDir, source);
          isIdiomaImport = resolvedImport.startsWith(resolvedIdiomaDir);
        }
        // Non-relative imports (e.g., 'some-package') won't match idiomaDir

        if (!isIdiomaImport) {
          return;
        }

        // Track all translatable imports
        for (const specifier of path.node.specifiers) {
          if (t.isImportSpecifier(specifier)) {
            const imported = t.isIdentifier(specifier.imported)
              ? specifier.imported.name
              : specifier.imported.value;
            const local = specifier.local.name;

            // Track Trans, useT, and t as translatable bindings
            if (
              imported === 'Trans' ||
              imported === 'useT' ||
              imported === 't'
            ) {
              state.translatableBindings.set(
                local,
                imported as 'Trans' | 'useT' | 't',
              );
            }
          }
        }
      },

      /**
       * Track variable aliases (e.g., const T = Trans).
       * Follows the binding chain for translatable components.
       */
      VariableDeclarator(path: NodePath<t.VariableDeclarator>, state) {
        const init = path.node.init;
        if (!t.isIdentifier(init)) return;

        const id = path.node.id;
        if (!t.isIdentifier(id)) return;

        // If the initializer is a translatable binding, propagate it
        const type = state.translatableBindings.get(init.name);
        if (type) {
          state.translatableBindings.set(id.name, type);
        }
      },

      /**
       * Transform t() and useT() calls.
       * In production: inlines translations as second argument.
       * In development: optionally extracts messages.
       */
      CallExpression(path: NodePath<t.CallExpression>, state) {
        const { opts, filename, translatableBindings, resolvedIdiomaDir } =
          state;
        const callee = path.node.callee;

        if (!t.isIdentifier(callee)) {
          return;
        }

        // Skip if idiomaDir not configured
        if (!resolvedIdiomaDir) {
          return;
        }

        const calleeName = callee.name;
        const bindingType = translatableBindings.get(calleeName);

        // Handle useT() calls in suspense mode
        // Unlike Trans, useT transforms in BOTH dev and prod for consistent Suspense behavior
        if (bindingType === 'useT' && opts.useSuspense) {
          // Mark that idioma is used (triggers chunk/loader injection)
          state.idiomaUsed = true;

          // Transform: useT() → __useTSuspense(__$idiomaChunk, __$idiomaLoad)
          path.replaceWith(
            t.callExpression(t.identifier('__useTSuspense'), [
              t.identifier('__$idiomaChunk'),
              t.identifier('__$idiomaLoad'),
            ]),
          );
          return;
        }

        // Track createT() calls for potential translation injection
        if (calleeName === 'createT') {
          state.createTCalls.push(path);
          return;
        }

        // Check if this is a t() call from idioma
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

          // In development mode, don't transform (template literal works at runtime)
          // In production mode, template literals with plural() need special handling
          // For now, mark as dynamic since runtime needs to evaluate the template
          state.hasDynamicT = true;
          return;
        }

        // Dynamic strings can't be inlined - mark for runtime translations
        if (!t.isStringLiteral(sourceArg)) {
          state.hasDynamicT = true;
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

        // In development mode, don't transform
        if (opts.mode !== 'production') {
          return;
        }

        // Production mode: inline translations
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
        const { opts, filename, translatableBindings, resolvedIdiomaDir } =
          state;
        const mode = opts.mode || 'development';

        // Skip if idiomaDir not configured
        if (!resolvedIdiomaDir) {
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
          // For member expressions like Idioma.Trans, check the property
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

        // In development mode, leave the code unchanged
        if (mode === 'development') {
          return;
        }

        // Production mode: transform the component
        if (!extracted) {
          // Key-only Trans or empty - skip transformation
          return;
        }

        // Mark that idioma was used in this file
        state.idiomaUsed = true;
        state.idiomaKeys.add(extracted.key);

        if (opts.useSuspense) {
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
      t.jsxExpressionContainer(t.identifier('__$idiomaChunk')),
    ),
    // __load: reference to injected loader object
    t.jsxAttribute(
      t.jsxIdentifier('__load'),
      t.jsxExpressionContainer(t.identifier('__$idiomaLoad')),
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
