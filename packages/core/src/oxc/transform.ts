import { dirname, relative, resolve } from 'path';
import MagicString from 'magic-string';
import {
  visitorKeys,
  type CallExpression,
  type ConditionalExpression,
  type Expression,
  type ImportDeclaration,
  type JSXAttribute,
  type JSXElement,
  type JSXOpeningElement,
  type Node,
  type ObjectExpression,
  type ObjectProperty,
  type Program,
  type VariableDeclarator,
} from 'oxc-parser';
import { getChunkId } from '../compiler/chunk-id.js';
import { generateKey } from '../keys/generator.js';
import {
  isAliasedIdiomaImport,
  type PathsMatcher,
} from '../utils/resolve-tsconfig-paths.js';
import { decodeJsxEntities } from './jsx-text.js';
import { createLineLookup, parseModule, type ParseFn } from './parse.js';
import {
  serializeJsxChildren,
  serializeTemplateLiteral,
  type SerializeResult,
} from './serialize.js';

export type MessageTranslations = Record<
  string,
  string | ((args: Record<string, unknown>) => string)
>;
export type Translations = Record<string, MessageTranslations>;

export interface ExtractedMessage {
  /** The message key (explicit id or generated hash) */
  key: string;
  /** The source message */
  source: string;
  context?: string;
  namespace?: string;
  /** Placeholder name to the text of its expression */
  placeholders: Record<string, string>;
  /** Component names */
  components: string[];
  /** `file:line` references */
  references: string[];
  /** `{0} = code` notes for complex expressions */
  comments?: string[];
}

export interface TransformOptions {
  /**
   * - 'inlined': every locale's message is written into the bundle (default)
   * - 'suspense': messages load per chunk through dynamic imports (React 19+)
   */
  mode?: 'inlined' | 'suspense';
  /** The compiled catalogue, for inlined mode */
  translations?: Translations;
  /** Called with each message the transform reads */
  onExtract?: (message: ExtractedMessage) => void;
  /** All locales (suspense mode) */
  locales?: string[];
  /** The idioma folder, relative to `projectRoot` (suspense mode) */
  outputDir?: string;
  /** The project root, for chunk ids (suspense mode) */
  projectRoot?: string;
  /** Absolute path of the idioma folder. Without it nothing is transformed. */
  idiomaDir?: string;
  /** Resolves tsconfig path aliases, for imports of the idioma folder by alias */
  pathsMatcher?: PathsMatcher;
  /** The parser. Vite passes Rolldown's `this.parse`; the default is oxc-parser. */
  parse?: ParseFn;
}

/**
 * The string edits the transform needs. magic-string's `MagicString` has
 * them, and so does Rolldown's native one (`meta.magicString`).
 */
export interface EditableString {
  overwrite(start: number, end: number, content: string): unknown;
  prependLeft(index: number, content: string): unknown;
  appendLeft(index: number, content: string): unknown;
  slice(start: number, end: number): string;
  hasChanged(): boolean;
  toString(): string;
}

export interface TransformResult {
  /** The transformed code */
  code: string;
  /** Whether anything changed */
  changed: boolean;
  /** The edits, for a bundler that wants a source map */
  edits: EditableString;
}

/** A call or element that cannot be inlined, with where it is. */
export class IdiomaTransformError extends Error {
  constructor(
    message: string,
    /** UTF-16 offset of the node in the source */
    readonly pos: number,
  ) {
    super(message);
    this.name = 'IdiomaTransformError';
  }
}

// Errors for calls that cannot be inlined (issue #14). Each one would render
// its id at runtime, and typecheck, compile and tests all stay green, so the
// build is the only place left to catch it.
const UNRESOLVED_T_ID_MESSAGE =
  '[idioma] t() needs an id that is a string literal, so Idioma can inline ' +
  'it at build time. Without inlining, the page renders the id. ' +
  "Write t({ id: 'some.key' }), or a conditional of string literals: " +
  "t({ id: live ? 'a.key' : 'b.key' }).";

const UNRESOLVED_TRANS_ID_MESSAGE =
  '[idioma] <Trans> needs an id that is a string literal, so Idioma can ' +
  'inline it at build time. Without inlining, the page renders the id, or ' +
  'the English text in every locale. Write id="some.key", or a conditional ' +
  "of string literals: id={live ? 'a.key' : 'b.key'}.";

const UNIMPORTED_TRANS_MESSAGE =
  '[idioma] This <Trans> with an id is not imported from the idioma folder, ' +
  'so Idioma cannot inline it, and the page renders its id. Import Trans ' +
  'from your generated idioma module.';

type BindingType = 'Trans' | 'useT' | 't' | 'createT';

/**
 * Transforms one module: `<Trans>` to `<__Trans>` and `t()` calls with every
 * locale's message inlined (or, in suspense mode, loaded per chunk), and fails
 * on a call that cannot be inlined. The output keeps its JSX and TypeScript,
 * for the bundler's next plugin.
 */
export function transformModule(
  code: string,
  filename: string,
  options: TransformOptions = {},
  edits: EditableString = new MagicString(code),
): TransformResult {
  if (!options.idiomaDir) {
    return { code, changed: false, edits };
  }
  const program = parseModule(code, filename, options.parse);
  const transform = new ModuleTransform(code, filename, options, edits);
  transform.run(program);
  return { code: edits.toString(), changed: edits.hasChanged(), edits };
}

class ModuleTransform {
  private readonly bindings = new Map<string, BindingType>();
  private readonly idiomaDir: string;
  private readonly lineOf: (offset: number) => number;
  /**
   * Subtrees a `<__Trans>` carries over, already walked: a conditional id
   * writes them once per branch, and each must be transformed once.
   */
  private readonly carried = new Set<Node>();
  private idiomaUsed = false;

  constructor(
    private readonly code: string,
    private readonly filename: string,
    private readonly options: TransformOptions,
    private readonly s: EditableString,
  ) {
    this.idiomaDir = resolve(options.idiomaDir!);
    this.lineOf = createLineLookup(code);
  }

  run(program: Program): void {
    this.visit(program, null);
    this.injectImports(program);
  }

  // ---- walking ----------------------------------------------------------

  private visit(node: Node, parent: Node | null): void {
    switch (node.type) {
      case 'ImportDeclaration':
        this.trackImport(node);
        return;
      case 'VariableDeclarator':
        this.trackDeclarator(node);
        break;
      case 'CallExpression':
        this.visitCall(node);
        return;
      case 'JSXElement':
        this.visitJsxElement(node, parent);
        return;
    }
    this.visitChildren(node);
  }

  private visitCarried(node: Node, parent: Node): void {
    if (this.carried.has(node)) return;
    this.carried.add(node);
    this.visit(node, parent);
  }

  private visitChildren(node: Node): void {
    const keys = visitorKeys[node.type];
    const record = node as unknown as Record<string, unknown>;
    for (const key of keys ?? Object.keys(record)) {
      const value = record[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) this.visit(item, node);
        }
      } else if (isNode(value)) {
        this.visit(value, node);
      }
    }
  }

  // ---- bindings -----------------------------------------------------------

  /** Tracks what is imported from the idioma folder, under its local names. */
  private trackImport(node: ImportDeclaration): void {
    const source = node.source.value;
    let fromIdioma = false;
    if (source.startsWith('.')) {
      fromIdioma = resolve(dirname(this.filename), source).startsWith(
        this.idiomaDir,
      );
    } else if (this.options.pathsMatcher) {
      fromIdioma = isAliasedIdiomaImport(
        source,
        this.idiomaDir,
        this.options.pathsMatcher,
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
        this.bindings.set(specifier.local.name, imported);
      }
    }
  }

  /** `const T = Trans` is a Trans; `const t = useT()` or `createT(...)` is a t. */
  private trackDeclarator(node: VariableDeclarator): void {
    if (node.id.type !== 'Identifier' || !node.init) return;
    const init = node.init;
    if (init.type === 'Identifier') {
      const type = this.bindings.get(init.name);
      if (type) this.bindings.set(node.id.name, type);
      return;
    }
    if (init.type === 'CallExpression' && init.callee.type === 'Identifier') {
      const type = this.bindings.get(init.callee.name);
      if (type === 'createT' || type === 'useT') {
        this.bindings.set(node.id.name, 't');
      }
    }
  }

  // ---- t() calls ----------------------------------------------------------

  private visitCall(call: CallExpression): void {
    const callee = call.callee;
    if (callee.type !== 'Identifier') {
      // props.t({ id }), this.t({ id }) and the like are never inlined
      this.throwIfUncreatedTCall(call);
      this.visitChildren(call);
      return;
    }

    const binding = this.bindings.get(callee.name);
    if (binding === 'useT' && this.options.mode === 'suspense') {
      this.idiomaUsed = true;
      this.s.overwrite(
        call.start,
        call.end,
        '__useTSuspense(__$idiomaChunk, __$idiomaLoad)',
      );
      return;
    }
    if (binding !== 't') {
      this.throwIfUncreatedTCall(call);
      this.visitChildren(call);
      return;
    }

    const arg = call.arguments[0];

    // Template literals are extracted and left for the runtime
    if (arg?.type === 'TemplateLiteral') {
      const serialized = serializeTemplateLiteral(arg, this.code);
      this.options.onExtract?.({
        key: generateKey(serialized.message),
        source: serialized.message,
        context: undefined,
        placeholders: serialized.placeholders,
        components: [],
        references: [this.reference(call)],
      });
      this.visitChildren(call);
      return;
    }

    if (arg?.type === 'ObjectExpression') {
      this.visitObjectTCall(call, arg);
      return;
    }

    // Dynamic strings cannot be inlined, and are left for the runtime
    if (!(arg?.type === 'Literal' && typeof arg.value === 'string')) {
      this.visitChildren(call);
      return;
    }

    const source = arg.value;
    const key = generateKey(source);
    this.options.onExtract?.({
      key,
      source,
      context: undefined,
      placeholders: {},
      components: [],
      references: [this.reference(call)],
    });

    if (this.options.mode === 'suspense') {
      this.idiomaUsed = true;
      this.visitChildren(call);
      this.s.overwrite(arg.start, arg.end, JSON.stringify(key));
      return;
    }

    const messages = this.options.translations?.[key];
    this.visitChildren(call);
    if (!messages) return;

    // t('source', values) becomes t('source', { __m }, values)
    const inlined = `{"__m": ${translationsObject(messages)}}`;
    const second = call.arguments[1];
    if (!second) {
      this.s.appendLeft(arg.end, `, ${inlined}`);
      return;
    }
    const last = call.arguments[call.arguments.length - 1]!;
    const keep = !(
      (second.type === 'Literal' && second.value === null) ||
      (second.type === 'Identifier' && second.name === 'undefined')
    );
    this.s.overwrite(
      second.start,
      last.end,
      keep ? `${inlined}, ${this.slice(second)}` : inlined,
    );
  }

  /** t({ id: 'key', source: 'text', values: {...} }) */
  private visitObjectTCall(call: CallExpression, arg: ObjectExpression): void {
    const idValue = findProperty(arg, 'id')?.value;
    if (idValue?.type === 'ConditionalExpression' && literalIdLeaves(idValue)) {
      // t({ id: c ? 'a' : 'b' }) becomes c ? t({ id: 'a' }) : t({ id: 'b' })
      const leaves = this.describeConditional(idValue, (id) =>
        this.describeTCall(arg, id),
      );
      this.visitChildren(call);
      this.s.overwrite(
        call.start,
        call.end,
        `(${this.printConditional(leaves, (id) => this.tCallText(call, arg, id))})`,
      );
      return;
    }

    const description = this.describeTCall(arg);
    if (!description) {
      throw this.error(UNRESOLVED_T_ID_MESSAGE, call);
    }
    this.visitChildren(call);
    const first = call.arguments[0]!;
    const last = call.arguments[call.arguments.length - 1]!;
    this.s.overwrite(
      first.start,
      last.end,
      this.tCallArgs(arg, description.id),
    );
  }

  /**
   * Reads a t() object argument, with `id` overridden for a conditional
   * branch. Extracts the message, as the call is about to be inlined.
   */
  private describeTCall(
    arg: ObjectExpression,
    idOverride?: string,
  ): { id: string } | null {
    const props = readTObject(arg);
    const id = idOverride ?? props.id;
    if (!id) return null;
    if (this.options.onExtract) {
      const extracted: ExtractedMessage = {
        key: id,
        source: props.source ?? '',
        placeholders: {},
        components: [],
        references: [this.reference(arg)],
      };
      if (props.context) extracted.context = props.context;
      if (props.ns) extracted.namespace = props.ns;
      this.options.onExtract(extracted);
    }
    if (this.options.mode === 'suspense') this.idiomaUsed = true;
    return { id };
  }

  private tCallText(call: CallExpression, arg: ObjectExpression, id: string) {
    return `${this.slice(call.callee)}(${this.tCallArgs(arg, id)})`;
  }

  /** The new arguments of an object-form t() call. */
  private tCallArgs(arg: ObjectExpression, id: string): string {
    const props = readTObject(arg);
    const values = props.values ? `, ${this.slice(props.values)}` : '';
    if (this.options.mode === 'suspense') {
      return `${JSON.stringify(id)}${values}`;
    }
    const first = JSON.stringify(props.source || id);
    const messages = this.lookup(id, props.ns);
    if (Object.keys(messages).length === 0) return `${first}${values}`;
    return `${first}, {"__m": ${translationsObject(messages)}}${values}`;
  }

  /**
   * Fails on a call that passes a catalogue key to a function that is not a
   * t() made by useT() or createT() in this file, for example a t passed in
   * as a parameter. Such a call is never inlined and renders its id.
   *
   * Only catalogue keys count: findUser({ id: 'abc' }) is not a translation
   * call. Suspense mode has no catalogue here, so it is not checked. In dev,
   * a transform that runs before the catalogue loads sees no keys and skips
   * the check; the build always has them.
   */
  private throwIfUncreatedTCall(call: CallExpression): void {
    const arg = call.arguments[0];
    const translations = this.options.translations as
      | (Translations & { __ns?: Record<string, Translations> })
      | undefined;
    if (!translations || arg?.type !== 'ObjectExpression') return;

    const ids = literalIdLeaves(findProperty(arg, 'id')?.value);
    if (!ids) return;
    const nsValue = findProperty(arg, 'ns')?.value;
    const ns = isStringLiteral(nsValue) ? nsValue.value : undefined;
    const id = ids.find((key) =>
      ns
        ? translations.__ns?.[ns]?.[key] !== undefined
        : translations[key] !== undefined,
    );
    if (!id) return;

    throw this.error(
      `[idioma] t({ id: '${id}' }) is called on a function that was not ` +
        'created by useT() or createT() in this file, so Idioma cannot inline ' +
        `it, and the page renders "${id}". Call useT() or createT(locale) in ` +
        'this file instead of passing t in.',
      call,
    );
  }

  // ---- <Trans> ------------------------------------------------------------

  private visitJsxElement(element: JSXElement, parent: Node | null): void {
    const opening = element.openingElement;
    const nameNode = opening.name;
    const componentName =
      nameNode.type === 'JSXIdentifier'
        ? nameNode.name
        : nameNode.type === 'JSXMemberExpression'
          ? nameNode.property.name
          : null;
    const idAttribute = getIdAttribute(opening);

    if (!componentName || this.bindings.get(componentName) !== 'Trans') {
      // A Trans with an id that does not come from the idioma folder is
      // never inlined, and renders its id (issue #14).
      if (
        idAttribute &&
        nameNode.type === 'JSXIdentifier' &&
        nameNode.name === 'Trans'
      ) {
        throw this.error(UNIMPORTED_TRANS_MESSAGE, element);
      }
      this.visitChildren(element);
      return;
    }

    const idExpression =
      idAttribute?.value?.type === 'JSXExpressionContainer' &&
      idAttribute.value.expression.type !== 'JSXEmptyExpression'
        ? idAttribute.value.expression
        : undefined;
    if (
      idExpression?.type === 'ConditionalExpression' &&
      literalIdLeaves(idExpression)
    ) {
      // <Trans id={c ? 'a' : 'b'}> becomes c ? <Trans id="a"> : <Trans id="b">
      const branches = this.describeConditional(idExpression, (id) =>
        this.describeTrans(element, id),
      );
      this.visit(idExpression.test, idExpression);
      const text = this.printConditional(branches, (id, described) =>
        described
          ? this.transText(element, described)
          : this.withId(element, idAttribute!, id),
      );
      const inJsx =
        parent?.type === 'JSXElement' ||
        parent?.type === 'JSXFragment' ||
        parent?.type === 'JSXAttribute';
      this.s.overwrite(
        element.start,
        element.end,
        inJsx ? `{${text}}` : `(${text})`,
      );
      return;
    }

    if (idAttribute && !isLiteralJsxAttributeValue(idAttribute)) {
      throw this.error(UNRESOLVED_TRANS_ID_MESSAGE, element);
    }

    const described = this.describeTrans(element);
    if (!described) {
      // A key-only Trans with no id, or an empty one: left as written
      this.visitChildren(element);
      return;
    }
    this.s.overwrite(
      element.start,
      element.end,
      this.transText(element, described),
    );
  }

  /**
   * Reads a Trans element's message, with `id` overridden for a conditional
   * branch, and extracts it. Null when it is not transformed: a key-only
   * Trans with no id, or children that serialize to nothing.
   */
  private describeTrans(
    element: JSXElement,
    idOverride?: string,
  ): DescribedTrans | null {
    const opening = element.openingElement;
    const id = idOverride ?? getStringAttribute(opening, 'id');
    const context = getStringAttribute(opening, 'context');
    const namespace = getStringAttribute(opening, 'ns');
    const keyOnly = element.children.length === 0 || opening.selfClosing;

    let message: ExtractedMessage;
    let serialized: SerializeResult | null = null;
    if (keyOnly) {
      // The message comes from the catalogue by its id (issue #17)
      if (!id) return null;
      message = {
        key: id,
        source: '',
        placeholders: {},
        components: [],
        references: [this.reference(element)],
      };
    } else {
      serialized = serializeJsxChildren(element.children, this.code);
      if (!serialized.message) return null;
      message = {
        key: id || generateKey(serialized.message, context, namespace),
        source: serialized.message,
        placeholders: serialized.placeholders,
        components: serialized.components,
        references: [this.reference(element)],
      };
      if (serialized.comments?.length) message.comments = serialized.comments;
    }
    if (context) message.context = context;
    if (namespace) message.namespace = namespace;

    this.options.onExtract?.(message);
    this.idiomaUsed = true;
    return {
      message,
      serialized,
      values: keyOnly ? getValuesExpression(opening) : undefined,
    };
  }

  /** The `<__Trans>` (or `<__TransSuspense>`) that replaces a Trans. */
  private transText(element: JSXElement, described: DescribedTrans): string {
    const { message, serialized, values } = described;

    // The expressions and component attributes carried over, with whatever
    // they hold transformed first, as Babel visited the new element.
    for (const node of Object.values(serialized?.placeholderNodes ?? {})) {
      this.visitCarried(node, element);
    }
    for (const component of serialized?.componentNodes ?? []) {
      for (const attribute of component.openingElement.attributes) {
        this.visitCarried(attribute, component.openingElement);
      }
    }
    if (values) this.visitCarried(values, element.openingElement);

    const props: string[] = [];
    if (this.options.mode === 'suspense') {
      props.push(
        `__key={${JSON.stringify(message.key)}}`,
        '__chunk={__$idiomaChunk}',
        '__load={__$idiomaLoad}',
      );
    } else {
      const messages = { ...this.lookup(message.key, message.namespace) };
      // A key-only Trans has no source, so it falls back to its id
      if (!messages['__source']) {
        messages['__source'] = message.source || message.key;
      }
      props.push(`__t={${translationsObject(messages)}}`);
    }

    if (message.namespace) {
      props.push(`__ns={${JSON.stringify(message.namespace)}}`);
    }
    const placeholderNames = Object.keys(message.placeholders);
    if (placeholderNames.length > 0) {
      const entries = placeholderNames.map((name) => {
        const node = serialized?.placeholderNodes[name];
        const value = node ? this.slice(node) : message.placeholders[name]!;
        return `${JSON.stringify(name)}: ${value}`;
      });
      props.push(`__a={{${entries.join(', ')}}}`);
    } else if (values) {
      props.push(`__a={${this.slice(values)}}`);
    }
    if (serialized && serialized.components.length > 0) {
      const elements = serialized.componentNodes.map((component) =>
        this.selfClosingText(component),
      );
      const names = serialized.components.map((name) => JSON.stringify(name));
      props.push(
        `__c={[${elements.join(', ')}]}`,
        `__cn={[${names.join(', ')}]}`,
      );
    }

    const tag =
      this.options.mode === 'suspense' ? '__TransSuspense' : '__Trans';
    return `<${tag} ${props.join(' ')} />`;
  }

  /** A component inside a Trans, with its attributes and no children. */
  private selfClosingText(component: JSXElement): string {
    const opening = component.openingElement;
    const attributes = opening.attributes.map((attribute) =>
      this.slice(attribute),
    );
    const name = this.slice(opening.name);
    return attributes.length > 0
      ? `<${name} ${attributes.join(' ')} />`
      : `<${name} />`;
  }

  /** The element as written, with its id attribute set to one branch's id. */
  private withId(
    element: JSXElement,
    idAttribute: JSXAttribute,
    id: string,
  ): string {
    const before = this.s.slice(element.start, idAttribute.start);
    const after = this.s.slice(idAttribute.end, element.end);
    return `${before}id=${JSON.stringify(id)}${after}`;
  }

  // ---- conditional ids ----------------------------------------------------

  /** Describes each branch of a conditional id, in source order. */
  private describeConditional<T>(
    conditional: ConditionalExpression,
    describe: (id: string) => T,
  ): ConditionalTree<T> {
    const branch = (node: Expression): ConditionalTree<T> | Leaf<T> => {
      if (node.type === 'ConditionalExpression') {
        return this.describeConditional(node, describe);
      }
      const id = (node as { value: string }).value;
      return { id, described: describe(id) };
    };
    return {
      test: conditional.test,
      consequent: branch(conditional.consequent),
      alternate: branch(conditional.alternate),
    };
  }

  private printConditional<T>(
    tree: ConditionalTree<T>,
    print: (id: string, described: T) => string,
  ): string {
    const branch = (node: ConditionalTree<T> | Leaf<T>): string =>
      'test' in node
        ? `(${this.printConditional(node, print)})`
        : print(node.id, node.described);
    return `${this.slice(tree.test)} ? ${branch(tree.consequent)} : ${branch(tree.alternate)}`;
  }

  // ---- output -------------------------------------------------------------

  /** Imports the runtime the transformed code calls. */
  private injectImports(program: Program): void {
    if (!this.idiomaUsed) return;
    let text: string;
    if (this.options.mode === 'suspense') {
      const { locales, outputDir, projectRoot } = this.options;
      if (!locales || !outputDir || !projectRoot) return;
      const chunkId = getChunkId(this.filename, projectRoot);
      const sourceDir = resolve(projectRoot, dirname(this.filename));
      const chunkDir = resolve(projectRoot, outputDir, '.generated', 'chunks');
      let chunkPath = relative(sourceDir, chunkDir);
      if (!chunkPath.startsWith('.')) chunkPath = `./${chunkPath}`;
      const loaders = locales.map((locale) => {
        const key = /^[A-Za-z_$][\w$]*$/.test(locale)
          ? locale
          : JSON.stringify(locale);
        const path = JSON.stringify(`${chunkPath}/${chunkId}.${locale}`);
        return `${key}: () => import(${path})`;
      });
      text =
        'import { __TransSuspense, __useTSuspense } from "@idioma/react/runtime-suspense";\n' +
        `const __$idiomaChunk = ${JSON.stringify(chunkId)};\n` +
        `const __$idiomaLoad = {${loaders.join(', ')}};\n`;
    } else {
      text = 'import { __Trans } from "@idioma/react";\n';
    }
    // After any directives ('use client'), as Babel's unshiftContainer did
    const first = program.body.find(
      (statement) =>
        !(statement.type === 'ExpressionStatement' && statement.directive),
    );
    if (first) {
      this.s.prependLeft(first.start, text);
    } else {
      this.s.appendLeft(program.end, `\n${text}`);
    }
  }

  // ---- helpers ------------------------------------------------------------

  /** The current text of a node, with edits inside it. */
  private slice(node: { start: number; end: number }): string {
    return this.s.slice(node.start, node.end);
  }

  private reference(node: Node): string {
    return `${this.filename}:${this.lineOf(node.start)}`;
  }

  private lookup(key: string, ns?: string): MessageTranslations {
    const translations = (this.options.translations ?? {}) as Translations & {
      __ns?: Record<string, Translations>;
    };
    return (ns ? translations.__ns?.[ns]?.[key] : translations[key]) ?? {};
  }

  private error(message: string, node: Node): IdiomaTransformError {
    return new IdiomaTransformError(
      `${this.filename}: ${message}\n${codeFrame(this.code, node.start)}`,
      node.start,
    );
  }
}

interface DescribedTrans {
  message: ExtractedMessage;
  serialized: SerializeResult | null;
  /** A key-only Trans's values={...} expression */
  values: Expression | undefined;
}

interface Leaf<T> {
  id: string;
  described: T;
}

interface ConditionalTree<T> {
  test: Expression;
  consequent: ConditionalTree<T> | Leaf<T>;
  alternate: ConditionalTree<T> | Leaf<T>;
}

/** `{"en": "Hello", "es": "Hola"}`, compiled ICU functions as code. */
function translationsObject(messages: MessageTranslations): string {
  const entries = Object.entries(messages).map(([locale, message]) => {
    const value =
      typeof message === 'string'
        ? JSON.stringify(message)
        : `(${String(message)})`;
    return `${JSON.stringify(locale)}: ${value}`;
  });
  return `{${entries.join(', ')}}`;
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

/**
 * The strings a static id can be: a string literal, or a conditional whose
 * branches are string literals or such conditionals, for example
 * `live ? 'set.live' : 'set.past'`. Null when any branch is something else,
 * which cannot be inlined at build time.
 */
export function literalIdLeaves(
  node: Node | null | undefined,
): string[] | null {
  if (isStringLiteral(node)) return [node.value];
  if (node?.type === 'ConditionalExpression') {
    const consequent = literalIdLeaves(node.consequent);
    const alternate = literalIdLeaves(node.alternate);
    return consequent && alternate ? [...consequent, ...alternate] : null;
  }
  return null;
}

/** A plain (not computed, not method) property of an object literal, by key. */
function findProperty(
  node: ObjectExpression,
  name: string,
): ObjectProperty | undefined {
  return node.properties.find(
    (prop): prop is ObjectProperty =>
      prop.type === 'Property' &&
      !prop.computed &&
      !prop.method &&
      prop.kind === 'init' &&
      ((prop.key.type === 'Identifier' && prop.key.name === name) ||
        (isStringLiteral(prop.key) && prop.key.value === name)),
  );
}

/** The static parts of a t() object argument. Spreads are ignored. */
function readTObject(node: ObjectExpression): {
  id?: string;
  source?: string;
  context?: string;
  ns?: string;
  values?: Expression;
} {
  const out: ReturnType<typeof readTObject> = {};
  for (const prop of node.properties) {
    if (
      prop.type !== 'Property' ||
      prop.computed ||
      prop.method ||
      prop.kind !== 'init'
    ) {
      continue;
    }
    const key =
      prop.key.type === 'Identifier'
        ? prop.key.name
        : isStringLiteral(prop.key)
          ? prop.key.value
          : undefined;
    if (key === 'values') {
      out.values = prop.value;
    } else if (
      (key === 'id' || key === 'source' || key === 'context' || key === 'ns') &&
      isStringLiteral(prop.value)
    ) {
      out[key] = prop.value.value;
    }
  }
  return out;
}

/** The id={...} or id="..." attribute of a JSX element, if it has one. */
function getIdAttribute(opening: JSXOpeningElement): JSXAttribute | undefined {
  return opening.attributes.find(
    (attr): attr is JSXAttribute =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === 'id',
  );
}

/** Whether an attribute's value is a string literal: id="x" or id={'x'}. */
function isLiteralJsxAttributeValue(attribute: JSXAttribute): boolean {
  const value = attribute.value;
  return (
    isStringLiteral(value) ||
    (value?.type === 'JSXExpressionContainer' &&
      isStringLiteral(value.expression))
  );
}

/**
 * A string attribute's value: prop="x" (entities decoded, as Babel's JSX
 * parser did) or prop={'x'}.
 */
function getStringAttribute(
  opening: JSXOpeningElement,
  name: string,
): string | undefined {
  for (const attr of opening.attributes) {
    if (
      attr.type !== 'JSXAttribute' ||
      attr.name.type !== 'JSXIdentifier' ||
      attr.name.name !== name
    ) {
      continue;
    }
    if (isStringLiteral(attr.value)) {
      return decodeJsxEntities(attr.value.value, false);
    }
    if (
      attr.value?.type === 'JSXExpressionContainer' &&
      isStringLiteral(attr.value.expression)
    ) {
      return attr.value.expression.value;
    }
  }
  return undefined;
}

/** The expression in a Trans element's values={...} prop, if it has one. */
function getValuesExpression(
  opening: JSXOpeningElement,
): Expression | undefined {
  for (const attr of opening.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === 'values' &&
      attr.value?.type === 'JSXExpressionContainer' &&
      attr.value.expression.type !== 'JSXEmptyExpression'
    ) {
      return attr.value.expression;
    }
  }
  return undefined;
}

/** Three lines of source around an offset, with a caret under it. */
function codeFrame(code: string, offset: number): string {
  const lines = code.split(/\r\n|\n|\r/);
  let line = 0;
  let column = offset;
  while (line < lines.length - 1 && column > lines[line]!.length) {
    column -= lines[line]!.length + 1;
    line++;
  }
  const first = Math.max(0, line - 1);
  const last = Math.min(lines.length - 1, line + 1);
  const width = String(last + 1).length;
  const out: string[] = [];
  for (let i = first; i <= last; i++) {
    const marker = i === line ? '>' : ' ';
    out.push(`${marker} ${String(i + 1).padStart(width)} | ${lines[i]}`);
    if (i === line) {
      out.push(`  ${' '.repeat(width)} | ${' '.repeat(column)}^`);
    }
  }
  return out.join('\n');
}
