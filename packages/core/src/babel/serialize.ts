import _generate from '@babel/generator';
import * as t from '@babel/types';
import {
  serializePluralCallToIcu,
  serializeSelectCallToIcu,
  serializeSelectOrdinalCallToIcu,
} from './extract-plural.js';

// Handle ESM/CJS interop for @babel/generator
const generate =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: typeof _generate }).default;

export interface SerializeResult {
  /** The serialized message for PO file */
  message: string;
  /** Map of placeholder names to their original expressions */
  placeholders: Record<string, string>;
  /** List of component names in order of appearance */
  components: string[];
  /** Original JSX element nodes (self-closing, with attributes preserved) parallel to components */
  componentNodes: t.JSXElement[];
  /** Comments for complex expressions */
  comments?: string[];
}

/**
 * Serialize JSX children to a PO-compatible message string.
 *
 * Converts:
 * - Text → as-is
 * - {identifier} → {identifier}
 * - {member.expression} → {member.expression}
 * - {complex()} → {0}, {1}, etc. with comments
 * - <Component>...</Component> → <0>...</0>, <1>...</1>, etc.
 * - <Component /> → <0/>, <1/>, etc.
 */
export function serializeJsxChildren(
  children: t.JSXElement['children'],
): SerializeResult {
  const placeholders: Record<string, string> = {};
  const components: string[] = [];
  const componentNodes: t.JSXElement[] = [];
  const comments: string[] = [];
  let complexExpressionIndex = 0;

  function serializeNode(node: t.Node): string {
    if (t.isJSXText(node)) {
      // Normalize whitespace: collapse multiple spaces, trim edges
      return node.value.replace(/\s+/g, ' ');
    }

    if (t.isJSXExpressionContainer(node)) {
      const expr = node.expression;

      if (t.isJSXEmptyExpression(expr)) {
        return '';
      }

      if (t.isIdentifier(expr)) {
        // Simple identifier: {name}
        placeholders[expr.name] = expr.name;
        return `{${expr.name}}`;
      }

      if (t.isMemberExpression(expr)) {
        // Member expression: {user.name}
        const code = generate(expr).code;
        placeholders[code] = code;
        return `{${code}}`;
      }

      // Check for plural(), select(), selectOrdinal() function calls - convert to ICU format
      if (t.isCallExpression(expr) && t.isIdentifier(expr.callee)) {
        const calleeName = expr.callee.name;

        if (calleeName === 'plural') {
          const { icu, variable } = serializePluralCallToIcu(expr);
          placeholders[variable] = variable;
          return icu;
        }

        if (calleeName === 'select') {
          const { icu, variable } = serializeSelectCallToIcu(expr);
          placeholders[variable] = variable;
          return icu;
        }

        if (calleeName === 'selectOrdinal') {
          const { icu, variable } = serializeSelectOrdinalCallToIcu(expr);
          placeholders[variable] = variable;
          return icu;
        }
      }

      // Complex expression: {fn()}, {a + b}, etc.
      const code = generate(expr).code;
      const index = complexExpressionIndex++;
      placeholders[String(index)] = code;
      comments.push(`{${index}} = ${code}`);
      return `{${index}}`;
    }

    if (t.isJSXElement(node)) {
      const opening = node.openingElement;
      const componentName = getElementName(opening.name);
      components.push(componentName);

      // Store a self-closing clone of the element with all attributes preserved.
      // Children are omitted — they come from the translated string at runtime.
      const selfClosingNode = t.jsxElement(
        t.jsxOpeningElement(
          t.cloneNode(opening.name),
          opening.attributes.map((attr) => t.cloneNode(attr)),
          true,
        ),
        null,
        [],
        true,
      );
      componentNodes.push(selfClosingNode);

      // Use named tags for better translator readability
      // e.g., <Link>click here</Link> instead of <0>click here</0>
      if (node.openingElement.selfClosing) {
        return `<${componentName}/>`;
      }

      const childContent = node.children.map(serializeNode).join('');
      return `<${componentName}>${childContent}</${componentName}>`;
    }

    if (t.isJSXFragment(node)) {
      // Flatten fragment content
      return node.children.map(serializeNode).join('');
    }

    return '';
  }

  function getElementName(
    name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
  ): string {
    if (t.isJSXIdentifier(name)) {
      return name.name;
    }
    if (t.isJSXMemberExpression(name)) {
      return `${getElementName(name.object)}.${name.property.name}`;
    }
    if (t.isJSXNamespacedName(name)) {
      return `${name.namespace.name}:${name.name.name}`;
    }
    return 'unknown';
  }

  const rawMessage = children.map(serializeNode).join('');

  // Normalize whitespace: trim and collapse multiple spaces
  const message = rawMessage.trim().replace(/\s+/g, ' ');

  const result: SerializeResult = {
    message,
    placeholders,
    components,
    componentNodes,
  };

  if (comments.length > 0) {
    result.comments = comments;
  }

  return result;
}

/**
 * Serialize a template literal to a PO-compatible message string.
 *
 * Converts:
 * - Static parts → as-is
 * - ${identifier} → {identifier}
 * - ${member.expression} → {member.expression}
 * - ${plural(count, {...})} → {count, plural, ...} (ICU format)
 * - ${complex()} → {0}, {1}, etc. with comments
 *
 * This is the shared implementation used by t() template literal extraction.
 */
export function serializeTemplateLiteral(
  template: t.TemplateLiteral,
): SerializeResult {
  const placeholders: Record<string, string> = {};
  const comments: string[] = [];
  let complexExpressionIndex = 0;

  // Build the message by interleaving quasis and expressions
  const parts: string[] = [];

  for (let i = 0; i < template.quasis.length; i++) {
    const quasi = template.quasis[i]!;
    // Add the static part (use cooked for proper escape handling)
    parts.push(quasi.value.cooked ?? quasi.value.raw);

    // Add the expression if not the last quasi
    if (i < template.expressions.length) {
      const expr = template.expressions[i]!;

      if (t.isIdentifier(expr)) {
        // Simple identifier: ${name}
        placeholders[expr.name] = expr.name;
        parts.push(`{${expr.name}}`);
      } else if (t.isMemberExpression(expr)) {
        // Member expression: ${user.name}
        const code = generate(expr).code;
        placeholders[code] = code;
        parts.push(`{${code}}`);
      } else if (t.isCallExpression(expr) && t.isIdentifier(expr.callee)) {
        // Check for plural(), select(), selectOrdinal() calls - convert to ICU format
        const calleeName = expr.callee.name;

        if (calleeName === 'plural') {
          const { icu, variable } = serializePluralCallToIcu(expr);
          placeholders[variable] = variable;
          parts.push(icu);
        } else if (calleeName === 'select') {
          const { icu, variable } = serializeSelectCallToIcu(expr);
          placeholders[variable] = variable;
          parts.push(icu);
        } else if (calleeName === 'selectOrdinal') {
          const { icu, variable } = serializeSelectOrdinalCallToIcu(expr);
          placeholders[variable] = variable;
          parts.push(icu);
        } else {
          // Other function call - treat as complex expression
          const code = generate(expr).code;
          const index = complexExpressionIndex++;
          placeholders[String(index)] = code;
          comments.push(`{${index}} = ${code}`);
          parts.push(`{${index}}`);
        }
      } else if (t.isExpression(expr)) {
        // Complex expression: ${fn()}, ${a + b}, etc.
        const code = generate(expr).code;
        const index = complexExpressionIndex++;
        placeholders[String(index)] = code;
        comments.push(`{${index}} = ${code}`);
        parts.push(`{${index}}`);
      }
    }
  }

  const message = parts.join('');

  const result: SerializeResult = {
    message,
    placeholders,
    components: [], // Template literals don't have JSX components
    componentNodes: [],
  };

  if (comments.length > 0) {
    result.comments = comments;
  }

  return result;
}
