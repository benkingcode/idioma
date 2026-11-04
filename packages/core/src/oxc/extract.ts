import { dirname, resolve } from 'path';
import {
  visitorKeys,
  type CallExpression,
  type ImportDeclaration,
  type JSXElement,
  type Node,
  type VariableDeclarator,
} from 'oxc-parser';
import { generateKey } from '../keys/generator.js';
import {
  isAliasedIdiomaImport,
  type PathsMatcher,
} from '../utils/resolve-tsconfig-paths.js';
import { decodeJsxEntities } from './jsx-text.js';
import { createLineLookup, parseModule, type ParseFn } from './parse.js';
import { serializeJsxChildren } from './serialize.js';
import { literalIdLeaves } from './transform.js';

/** A message as `idioma extract` writes it to the catalogue. */
export interface CatalogueMessage {
  key: string;
  source: string;
  location: string;
  /** Line number in the source file (1-indexed) */
  line: number;
  context?: string;
  /** Translator comment (the PO `#.` comment) */
  comment?: string;
  namespace?: string;
}

export interface ExtractModuleOptions {
  /** The path shown in the catalogue's references */
  displayPath: string;
  /** Absolute path of the idioma folder. Without it nothing is extracted. */
  idiomaDir?: string;
  pathsMatcher?: PathsMatcher;
  parse?: ParseFn;
}

type BindingType = 'Trans' | 'useT' | 't' | 'createT';

/**
 * The messages one module adds to the catalogue: each `<Trans>` and `t()`
 * from the idioma folder. Lenient where the transform is strict: a call
 * without a static id is skipped, so a file being edited in dev mode keeps
 * its other messages.
 */
export function extractModule(
  code: string,
  filename: string,
  options: ExtractModuleOptions,
): CatalogueMessage[] {
  const messages: CatalogueMessage[] = [];
  if (!options.idiomaDir) return messages;

  const idiomaDir = options.idiomaDir;
  const program = parseModule(code, filename, options.parse);
  const lineOf = createLineLookup(code);
  const bindings = new Map<string, BindingType>();

  const visit = (node: Node): void => {
    switch (node.type) {
      case 'ImportDeclaration':
        trackImport(node);
        return;
      case 'VariableDeclarator':
        trackDeclarator(node);
        break;
      case 'JSXElement':
        readTrans(node);
        break;
      case 'CallExpression':
        readTCall(node);
        break;
    }
    const record = node as unknown as Record<string, unknown>;
    for (const key of visitorKeys[node.type] ?? Object.keys(record)) {
      const value = record[key];
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) visit(item);
      } else if (isNode(value)) {
        visit(value);
      }
    }
  };

  function trackImport(node: ImportDeclaration): void {
    const source = node.source.value;
    let fromIdioma = false;
    if (source.startsWith('.')) {
      fromIdioma = resolve(dirname(filename), source).startsWith(idiomaDir);
    } else if (options.pathsMatcher) {
      fromIdioma = isAliasedIdiomaImport(
        source,
        idiomaDir,
        options.pathsMatcher,
      );
    }
    if (!fromIdioma) return;
    for (const specifier of node.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue;
      const imported =
        specifier.imported.type === 'Literal'
          ? specifier.imported.value
          : specifier.imported.name;
      if (
        imported === 'Trans' ||
        imported === 'useT' ||
        imported === 't' ||
        imported === 'createT'
      ) {
        bindings.set(specifier.local.name, imported);
      }
    }
  }

  function trackDeclarator(node: VariableDeclarator): void {
    if (node.id.type !== 'Identifier' || !node.init) return;
    const init = node.init;
    if (init.type === 'Identifier') {
      const type = bindings.get(init.name);
      if (type) bindings.set(node.id.name, type);
      return;
    }
    if (init.type === 'CallExpression' && init.callee.type === 'Identifier') {
      const type = bindings.get(init.callee.name);
      if (type === 'createT' || type === 'useT') {
        bindings.set(node.id.name, 't');
      }
    }
  }

  function readTrans(element: JSXElement): void {
    const name = element.openingElement.name;
    if (name.type !== 'JSXIdentifier' || bindings.get(name.name) !== 'Trans') {
      return;
    }

    let ids: string[] = [];
    let context: string | undefined;
    let comment: string | undefined;
    let namespace: string | undefined;
    for (const attr of element.openingElement.attributes) {
      if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') {
        continue;
      }
      const value = attr.value;
      // id="key", id={'key'} or id={live ? 'a' : 'b'} (issue #14)
      if (attr.name.name === 'id') {
        if (value?.type === 'JSXExpressionContainer') {
          ids =
            value.expression.type === 'JSXEmptyExpression'
              ? []
              : (literalIdLeaves(value.expression) ?? []);
        } else if (isStringLiteral(value)) {
          ids = [decodeJsxEntities(value.value, false)];
        } else {
          ids = [];
        }
      }
      // context, comment and ns are read as plain strings only, as before
      if (isStringLiteral(value)) {
        const text = decodeJsxEntities(value.value, false);
        if (attr.name.name === 'context') context = text;
        if (attr.name.name === 'comment') comment = text;
        if (attr.name.name === 'ns') namespace = text;
      }
    }

    const { message: source } = serializeJsxChildren(element.children, code);
    // A key-only Trans (issue #17) has an id and no source
    if (!source && ids.length === 0) return;

    const keys =
      ids.length > 0 ? ids : [generateKey(source, context, namespace)];
    const line = lineOf(element.start);
    for (const key of keys) {
      messages.push({
        key,
        source,
        location: options.displayPath,
        line,
        context,
        comment,
        namespace,
      });
    }
  }

  function readTCall(call: CallExpression): void {
    if (call.callee.type !== 'Identifier') return;
    if (bindings.get(call.callee.name) !== 't') return;
    const arg = call.arguments[0];
    if (!arg) return;
    const line = lineOf(call.start);

    if (arg.type === 'ObjectExpression') {
      let ids: string[] | null = null;
      let source: string | undefined;
      let context: string | undefined;
      let namespace: string | undefined;
      for (const prop of arg.properties) {
        if (prop.type !== 'Property' || prop.computed || prop.method) continue;
        if (prop.kind !== 'init') continue;
        const key =
          prop.key.type === 'Identifier'
            ? prop.key.name
            : isStringLiteral(prop.key)
              ? prop.key.value
              : undefined;
        if (!key) continue;
        if (key === 'id') {
          // A string literal, or a conditional of them (issue #14)
          ids = literalIdLeaves(prop.value);
        } else if (isStringLiteral(prop.value)) {
          if (key === 'source') source = prop.value.value;
          if (key === 'context') context = prop.value.value;
          if (key === 'ns') namespace = prop.value.value;
        }
      }
      // No static id: skipped here; the transform fails the build for it
      if (!ids) return;
      for (const key of ids) {
        messages.push({
          key,
          source: source ?? '',
          location: options.displayPath,
          line,
          context,
          namespace,
        });
      }
      return;
    }

    if (isStringLiteral(arg)) {
      messages.push({
        key: generateKey(arg.value),
        source: arg.value,
        location: options.displayPath,
        line,
      });
    }
  }

  visit(program);
  return messages;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function isStringLiteral(
  node: Node | null | undefined,
): node is Node & { type: 'Literal'; value: string } {
  return node?.type === 'Literal' && typeof node.value === 'string';
}
