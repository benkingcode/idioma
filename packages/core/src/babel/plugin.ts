import type { NodePath, PluginObj } from '@babel/core';
import * as t from '@babel/types';
import { getChunkId } from '../compiler/chunk-id.js';
import { generateKey } from '../keys/generator.js';
import { extractTransMessage, type ExtractedMessage } from './extract-trans.js';
import { serializeJsxChildren } from './serialize.js';

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
            // Inject: import { translations as __$translations } from '{outputDir}/translations.js'
            const translationsImport = t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('__$translations'),
                  t.identifier('translations'),
                ),
              ],
              t.stringLiteral(`${opts.outputDir}/translations.js`),
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
            const { locales, outputDir } = opts;
            if (!locales || !outputDir) {
              return;
            }

            // Inject import for __TransSuspense
            const importDecl = t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('__TransSuspense'),
                  t.identifier('__TransSuspense'),
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
                    t.stringLiteral(`${outputDir}/chunks/${chunkId}.${locale}`),
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
       * Transform t() calls from createT.
       * In production: inlines translations as second argument.
       * In development: optionally extracts messages.
       */
      CallExpression(path: NodePath<t.CallExpression>, state) {
        const { opts, filename } = state;
        const callee = path.node.callee;

        // Track createT() calls for potential translation injection
        if (t.isIdentifier(callee) && callee.name === 'createT') {
          state.createTCalls.push(path);
          return;
        }

        // Only handle calls like t('string')
        if (!t.isIdentifier(callee) || callee.name !== 't') {
          return;
        }

        // Get the first argument (source string)
        const args = path.node.arguments;
        const sourceArg = args[0];

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
                : t.stringLiteral(String(msg)),
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
        const { opts, filename } = state;
        const mode = opts.mode || 'development';

        // Check if this is a Trans component
        const opening = path.node.openingElement;
        if (!isTransComponent(opening.name)) {
          return;
        }

        // Extract the message
        const extracted = extractTransMessage(path, filename);

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
 * Check if the element name is "Trans"
 */
function isTransComponent(
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
): boolean {
  if (t.isJSXIdentifier(name)) {
    return name.name === 'Trans';
  }
  if (t.isJSXMemberExpression(name)) {
    return t.isJSXIdentifier(name.property) && name.property.name === 'Trans';
  }
  return false;
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
      // Function translations are serialized differently
      tEntries.push(
        t.objectProperty(
          t.stringLiteral(locale),
          t.stringLiteral(String(translation)),
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

  // Build props array
  const props: t.JSXAttribute[] = [
    // __t: translations object
    t.jsxAttribute(
      t.jsxIdentifier('__t'),
      t.jsxExpressionContainer(t.objectExpression(tEntries)),
    ),
  ];

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
      // For simple identifiers, reference the variable directly
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
        aEntries.push(
          t.objectProperty(t.stringLiteral(name), t.identifier(expr)),
        );
      } else {
        // For complex expressions, we'd need to preserve the original expression
        // For now, just use the string representation
        aEntries.push(
          t.objectProperty(
            t.stringLiteral(name),
            t.identifier(expr.split('.')[0] || 'undefined'),
          ),
        );
      }
    }

    props.push(
      t.jsxAttribute(
        t.jsxIdentifier('__a'),
        t.jsxExpressionContainer(t.objectExpression(aEntries)),
      ),
    );
  }

  // Add __c if there are components
  if (components.length > 0) {
    const componentElements = components.map((name) => t.identifier(name));

    props.push(
      t.jsxAttribute(
        t.jsxIdentifier('__c'),
        t.jsxExpressionContainer(t.arrayExpression(componentElements)),
      ),
    );
  }

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
  const { key, placeholders, components, namespace } = extracted;

  // Build props array
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
  ];

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
      // For simple identifiers, reference the variable directly
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
        aEntries.push(
          t.objectProperty(t.stringLiteral(name), t.identifier(expr)),
        );
      } else {
        // For complex expressions, use the first part
        aEntries.push(
          t.objectProperty(
            t.stringLiteral(name),
            t.identifier(expr.split('.')[0] || 'undefined'),
          ),
        );
      }
    }

    props.push(
      t.jsxAttribute(
        t.jsxIdentifier('__a'),
        t.jsxExpressionContainer(t.objectExpression(aEntries)),
      ),
    );
  }

  // Add __c if there are components
  if (components.length > 0) {
    const componentElements = components.map((name) => t.identifier(name));

    props.push(
      t.jsxAttribute(
        t.jsxIdentifier('__c'),
        t.jsxExpressionContainer(t.arrayExpression(componentElements)),
      ),
    );
  }

  // Create the new __TransSuspense element
  const newElement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('__TransSuspense'), props, true),
    null,
    [],
    true,
  );

  path.replaceWith(newElement);
}
