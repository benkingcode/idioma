import generate from '@babel/generator';
import * as t from '@babel/types';

export interface SerializeResult {
  /** The serialized message for PO file */
  message: string;
  /** Map of placeholder names to their original expressions */
  placeholders: Record<string, string>;
  /** List of component names in order of appearance */
  components: string[];
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
      const componentIndex = components.length;
      components.push(componentName);

      if (node.openingElement.selfClosing) {
        return `<${componentIndex}/>`;
      }

      const childContent = node.children.map(serializeNode).join('');
      return `<${componentIndex}>${childContent}</${componentIndex}>`;
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
  };

  if (comments.length > 0) {
    result.comments = comments;
  }

  return result;
}
