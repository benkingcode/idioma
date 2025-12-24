import type { NodePath, PluginObj } from '@babel/core';
import * as t from '@babel/types';
import { generateKey } from '../keys/generator';
import { extractTransMessage, type ExtractedMessage } from './extract-trans';
import { serializeJsxChildren } from './serialize';

export interface IdiomaPluginOptions {
  /** Plugin mode: 'development' or 'production' */
  mode?: 'development' | 'production';
  /** Pre-compiled translations object (for production) */
  translations?: Record<
    string,
    Record<string, string | ((args: Record<string, unknown>) => string)>
  >;
  /** Callback for extracted messages (for extraction phase) */
  onExtract?: (message: ExtractedMessage) => void;
}

/**
 * Idioma Babel plugin for transforming Trans components and useT hooks.
 *
 * In development mode:
 * - Leaves code unchanged
 * - Optionally extracts messages via onExtract callback
 *
 * In production mode:
 * - Transforms <Trans>...</Trans> to <__Trans __t={...} __a={...} __c={...} />
 * - Inlines pre-compiled translations
 */
export default function idiomaPlugin(): PluginObj {
  return {
    name: 'idioma',

    visitor: {
      JSXElement(path: NodePath<t.JSXElement>, state) {
        const opts = (state.opts || {}) as IdiomaPluginOptions;
        const mode = opts.mode || 'development';
        const filename = state.filename || 'unknown';

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

        transformTransComponent(path, extracted, opts.translations || {});
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
  const { key, source, placeholders, components } = extracted;

  // Get translations for this key
  const messageTranslations = translations[key] || {};

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
