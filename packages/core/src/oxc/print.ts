import type { Expression, Node } from 'oxc-parser';

/**
 * The text of an expression as Babel's generator printed it, where that text
 * becomes part of a message: a placeholder name (`{user.name}`) or a plural
 * variable. Identifiers, literals, `this` and member chains of them are
 * printed from the AST, so `user .name` reads `user.name` as it did under
 * Babel. Anything else is the source text, which is only ever used as code.
 */
export function printExpression(node: Expression | Node, code: string): string {
  switch (node.type) {
    case 'Identifier':
      return node.name;
    case 'ThisExpression':
      return 'this';
    case 'Literal':
      return node.raw ?? code.slice(node.start, node.end);
    case 'PrivateIdentifier':
      return `#${node.name}`;
    case 'MemberExpression': {
      const object = printExpression(node.object, code);
      if (node.computed) {
        return `${object}[${printExpression(node.property, code)}]`;
      }
      return `${object}.${printExpression(node.property, code)}`;
    }
    default:
      return code.slice(node.start, node.end);
  }
}
