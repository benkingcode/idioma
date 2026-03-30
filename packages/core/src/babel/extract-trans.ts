import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { generateKey } from '../keys/generator.js';
import { serializeJsxChildren } from './serialize.js';

export interface ExtractedMessage {
  /** The message key (explicit id or generated hash) */
  key: string;
  /** The source message */
  source: string;
  /** Optional context */
  context?: string;
  /** Optional namespace */
  namespace?: string;
  /** Placeholder mappings */
  placeholders: Record<string, string>;
  /** Component names */
  components: string[];
  /** File:line references */
  references: string[];
  /** Comments for complex expressions */
  comments?: string[];
}

/**
 * Extract a message from a Trans JSX element.
 *
 * @param path - The Babel path to the JSX element
 * @param filename - The source filename for references
 * @param skipNameCheck - If true, skip the Trans component name check (caller has already verified)
 * @returns The extracted message, or null if not a Trans component or empty
 */
export function extractTransMessage(
  path: NodePath<t.JSXElement>,
  filename: string,
  skipNameCheck = false,
): ExtractedMessage | null {
  const opening = path.node.openingElement;

  // Check if this is a Trans component (skip if caller already verified)
  if (!skipNameCheck && !isTransComponent(opening.name)) {
    return null;
  }

  // Get props
  const idProp = getStringProp(opening, 'id');
  const contextProp = getStringProp(opening, 'context');
  const nsProp = getStringProp(opening, 'ns');

  // Skip key-only Trans (self-closing or empty)
  const children = path.node.children;
  if (children.length === 0 || opening.selfClosing) {
    return null;
  }

  // Serialize children to message
  const serialized = serializeJsxChildren(children);

  // Skip if message is empty after serialization
  if (!serialized.message) {
    return null;
  }

  // Generate or use explicit key (namespace affects the key hash)
  const key = idProp || generateKey(serialized.message, contextProp, nsProp);

  // Get line number for reference
  const line = path.node.loc?.start.line || 0;

  const result: ExtractedMessage = {
    key,
    source: serialized.message,
    placeholders: serialized.placeholders,
    components: serialized.components,
    references: [`${filename}:${line}`],
  };

  if (contextProp) {
    result.context = contextProp;
  }

  if (nsProp) {
    result.namespace = nsProp;
  }

  if (serialized.comments && serialized.comments.length > 0) {
    result.comments = serialized.comments;
  }

  return result;
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
    // Handle Idiomi.Trans or similar
    return t.isJSXIdentifier(name.property) && name.property.name === 'Trans';
  }
  return false;
}

/**
 * Get a string prop value from JSX opening element
 */
function getStringProp(
  opening: t.JSXOpeningElement,
  propName: string,
): string | undefined {
  for (const attr of opening.attributes) {
    if (
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === propName
    ) {
      if (t.isStringLiteral(attr.value)) {
        return attr.value.value;
      }
      if (
        t.isJSXExpressionContainer(attr.value) &&
        t.isStringLiteral(attr.value.expression)
      ) {
        return attr.value.expression.value;
      }
    }
  }
  return undefined;
}
