import type {
  Expression,
  JSXChild,
  JSXElement,
  JSXElementName,
  Node,
  TemplateLiteral,
} from 'oxc-parser';
import { isIcuCallName, serializeIcuCall } from './icu-calls.js';
import { cleanJsxText, decodeJsxEntities } from './jsx-text.js';
import { printExpression } from './print.js';

export interface SerializeResult {
  /** The message as it goes in the catalogue */
  message: string;
  /** Placeholder name to the text of its expression */
  placeholders: Record<string, string>;
  /**
   * Placeholder name to its expression node, so a transform can copy the
   * expression with any edits inside it. Absent for an ICU variable, whose
   * text is the value.
   */
  placeholderNodes: Record<string, Node>;
  /** Component names in order of appearance */
  components: string[];
  /** The component elements, parallel to `components` */
  componentNodes: JSXElement[];
  /** `{0} = code` notes for complex expressions */
  comments?: string[];
}

/** One child as Babel's `react.buildChildren` returns it. */
type BuiltChild = { type: 'text'; value: string } | Node;

/**
 * Babel's `react.buildChildren`: text children cleaned of JSX whitespace (and
 * dropped when empty), expression containers unwrapped, empty ones dropped.
 */
function buildChildren(children: JSXChild[]): BuiltChild[] {
  const built: BuiltChild[] = [];
  for (const child of children) {
    if (child.type === 'JSXText') {
      const text = cleanJsxText(decodeJsxEntities(child.value, true));
      if (text !== null) built.push({ type: 'text', value: text });
      continue;
    }
    if (child.type === 'JSXExpressionContainer') {
      if (child.expression.type !== 'JSXEmptyExpression') {
        built.push(child.expression);
      }
      continue;
    }
    built.push(child);
  }
  return built;
}

/**
 * Serializes JSX children to a catalogue message, as the Babel serializer did:
 *
 * - text as written, with JSX whitespace rules
 * - `{name}` and `{user.name}` stay placeholders by name
 * - `plural()`, `select()`, `selectOrdinal()` become ICU
 * - `<b>x</b>` becomes `<b>x</b>`, `<br />` becomes `<br/>`
 * - anything else becomes `{0}`, `{1}`, with a `{0} = code` note
 */
export function serializeJsxChildren(
  children: JSXChild[],
  code: string,
): SerializeResult {
  const placeholders: Record<string, string> = {};
  const placeholderNodes: Record<string, Node> = {};
  const components: string[] = [];
  const componentNodes: JSXElement[] = [];
  const comments: string[] = [];
  let complexIndex = 0;

  const serializeChildren = (list: JSXChild[]): string =>
    buildChildren(list).map(serializeNode).join('');

  function serializeNode(node: BuiltChild): string {
    if (node.type === 'text') return node.value;

    // {" "} and {'text'} are text, not placeholders (issue #5)
    if (node.type === 'Literal' && typeof node.value === 'string') {
      return node.value;
    }

    if (node.type === 'Identifier') {
      placeholders[node.name] = node.name;
      placeholderNodes[node.name] = node;
      return `{${node.name}}`;
    }

    if (node.type === 'MemberExpression') {
      const text = printExpression(node, code);
      placeholders[text] = text;
      placeholderNodes[text] = node;
      return `{${text}}`;
    }

    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      isIcuCallName(node.callee.name)
    ) {
      const { icu, variable } = serializeIcuCall(node.callee.name, node, code);
      placeholders[variable] = variable;
      return icu;
    }

    if (node.type === 'JSXElement') {
      const name = elementName(node.openingElement.name);
      components.push(name);
      componentNodes.push(node);
      if (node.openingElement.selfClosing) return `<${name}/>`;
      return `<${name}>${serializeChildren(node.children)}</${name}>`;
    }

    if (node.type === 'JSXFragment') {
      return serializeChildren(node.children);
    }

    if (node.type === 'JSXSpreadChild') return '';

    const text = code.slice(node.start, node.end);
    const index = String(complexIndex++);
    placeholders[index] = text;
    placeholderNodes[index] = node;
    comments.push(`{${index}} = ${text}`);
    return `{${index}}`;
  }

  const message = serializeChildren(children).trim().replace(/ {2,}/g, ' ');
  const result: SerializeResult = {
    message,
    placeholders,
    placeholderNodes,
    components,
    componentNodes,
  };
  if (comments.length > 0) result.comments = comments;
  return result;
}

/**
 * Serializes a `t()` template literal: `${name}` and `${user.name}` by name,
 * ICU calls as ICU, anything else as `{0}`.
 */
export function serializeTemplateLiteral(
  template: TemplateLiteral,
  code: string,
): SerializeResult {
  const placeholders: Record<string, string> = {};
  const placeholderNodes: Record<string, Node> = {};
  const comments: string[] = [];
  let complexIndex = 0;
  const parts: string[] = [];

  template.quasis.forEach((quasi, i) => {
    parts.push(quasi.value.cooked ?? quasi.value.raw);
    const expression: Expression | undefined = template.expressions[i];
    if (!expression) return;

    if (expression.type === 'Identifier') {
      placeholders[expression.name] = expression.name;
      placeholderNodes[expression.name] = expression;
      parts.push(`{${expression.name}}`);
    } else if (expression.type === 'MemberExpression') {
      const text = printExpression(expression, code);
      placeholders[text] = text;
      placeholderNodes[text] = expression;
      parts.push(`{${text}}`);
    } else if (
      expression.type === 'CallExpression' &&
      expression.callee.type === 'Identifier' &&
      isIcuCallName(expression.callee.name)
    ) {
      const { icu, variable } = serializeIcuCall(
        expression.callee.name,
        expression,
        code,
      );
      placeholders[variable] = variable;
      parts.push(icu);
    } else {
      const text = code.slice(expression.start, expression.end);
      const index = String(complexIndex++);
      placeholders[index] = text;
      placeholderNodes[index] = expression;
      comments.push(`{${index}} = ${text}`);
      parts.push(`{${index}}`);
    }
  });

  const result: SerializeResult = {
    message: parts.join(''),
    placeholders,
    placeholderNodes,
    components: [],
    componentNodes: [],
  };
  if (comments.length > 0) result.comments = comments;
  return result;
}

/** `Trans`, `Foo.Bar`, or `svg:path`, as the serializer names a component. */
export function elementName(name: JSXElementName): string {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    return `${elementName(name.object)}.${name.property.name}`;
  }
  return `${name.namespace.name}:${name.name.name}`;
}
