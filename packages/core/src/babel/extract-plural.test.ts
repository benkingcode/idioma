import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';
import {
  serializePluralCallToIcu,
  serializePluralToIcu,
} from './extract-plural';

function parsePluralJsx(code: string): t.JSXElement | null {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let pluralElement: t.JSXElement | null = null;

  traverse(ast, {
    JSXElement(path) {
      const name = path.node.openingElement.name;
      if (t.isJSXIdentifier(name) && name.name === 'Plural') {
        pluralElement = path.node;
        path.stop();
      }
    },
  });

  return pluralElement;
}

describe('serializePluralToIcu', () => {
  it('converts simple one/other Plural to ICU', () => {
    const element = parsePluralJsx(`
      <Plural value={count} one="# item" other="# items" />
    `);

    const result = serializePluralToIcu(element!);

    expect(result.icu).toBe('{count, plural, one {# item} other {# items}}');
    expect(result.variable).toBe('count');
  });

  it('converts Plural with zero form', () => {
    const element = parsePluralJsx(`
      <Plural value={count} zero="no items" one="# item" other="# items" />
    `);

    const result = serializePluralToIcu(element!);

    expect(result.icu).toBe(
      '{count, plural, zero {no items} one {# item} other {# items}}',
    );
  });

  it('converts Plural with all forms', () => {
    const element = parsePluralJsx(`
      <Plural
        value={n}
        zero="none"
        one="one"
        two="two"
        few="few"
        many="many"
        other="other"
      />
    `);

    const result = serializePluralToIcu(element!);

    expect(result.icu).toBe(
      '{n, plural, zero {none} one {one} two {two} few {few} many {many} other {other}}',
    );
    expect(result.variable).toBe('n');
  });

  it('handles member expression value', () => {
    const element = parsePluralJsx(`
      <Plural value={data.count} one="# item" other="# items" />
    `);

    const result = serializePluralToIcu(element!);

    expect(result.icu).toBe(
      '{data.count, plural, one {# item} other {# items}}',
    );
    expect(result.variable).toBe('data.count');
  });

  it('preserves # placeholder in forms', () => {
    const element = parsePluralJsx(`
      <Plural value={count} one="You have # message" other="You have # messages" />
    `);

    const result = serializePluralToIcu(element!);

    expect(result.icu).toContain('one {You have # message}');
    expect(result.icu).toContain('other {You have # messages}');
  });

  it('escapes ICU special characters in forms', () => {
    const element = parsePluralJsx(`
      <Plural value={count} one="{count} item" other="{count} items" />
    `);

    const result = serializePluralToIcu(element!);

    // Curly braces in the form text should be escaped
    // '{count}' is quoted as a whole - this is valid ICU
    expect(result.icu).toContain("one {'{count}' item}");
  });

  it('throws for missing value prop', () => {
    const element = parsePluralJsx(`
      <Plural one="# item" other="# items" />
    `);

    expect(() => serializePluralToIcu(element!)).toThrow(
      'Plural requires a value prop',
    );
  });

  it('throws for missing other form', () => {
    const element = parsePluralJsx(`
      <Plural value={count} one="# item" />
    `);

    expect(() => serializePluralToIcu(element!)).toThrow(
      'Plural requires an "other" form',
    );
  });
});

/**
 * Helper to parse a plural() function call from code.
 * Extracts the CallExpression AST node for testing.
 */
function parsePluralCall(code: string): t.CallExpression | null {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let callExpr: t.CallExpression | null = null;

  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee) &&
        path.node.callee.name === 'plural'
      ) {
        callExpr = path.node;
        path.stop();
      }
    },
  });

  return callExpr;
}

describe('serializePluralCallToIcu', () => {
  it('converts simple one/other plural() call to ICU', () => {
    const call = parsePluralCall(`
      plural(count, { one: "# item", other: "# items" })
    `);

    const result = serializePluralCallToIcu(call!);

    expect(result.icu).toBe('{count, plural, one {# item} other {# items}}');
    expect(result.variable).toBe('count');
  });

  it('converts plural() call with zero form', () => {
    const call = parsePluralCall(`
      plural(count, { zero: "no items", one: "# item", other: "# items" })
    `);

    const result = serializePluralCallToIcu(call!);

    expect(result.icu).toBe(
      '{count, plural, zero {no items} one {# item} other {# items}}',
    );
  });

  it('converts plural() call with all forms', () => {
    const call = parsePluralCall(`
      plural(n, {
        zero: "none",
        one: "one",
        two: "two",
        few: "few",
        many: "many",
        other: "other"
      })
    `);

    const result = serializePluralCallToIcu(call!);

    expect(result.icu).toBe(
      '{n, plural, zero {none} one {one} two {two} few {few} many {many} other {other}}',
    );
    expect(result.variable).toBe('n');
  });

  it('handles member expression value', () => {
    const call = parsePluralCall(`
      plural(data.count, { one: "# item", other: "# items" })
    `);

    const result = serializePluralCallToIcu(call!);

    expect(result.icu).toBe(
      '{data.count, plural, one {# item} other {# items}}',
    );
    expect(result.variable).toBe('data.count');
  });

  it('handles call expression value like items.length', () => {
    const call = parsePluralCall(`
      plural(items.length, { one: "# item", other: "# items" })
    `);

    const result = serializePluralCallToIcu(call!);

    expect(result.icu).toBe(
      '{items.length, plural, one {# item} other {# items}}',
    );
    expect(result.variable).toBe('items.length');
  });

  it('preserves # placeholder in forms', () => {
    const call = parsePluralCall(`
      plural(count, { one: "You have # message", other: "You have # messages" })
    `);

    const result = serializePluralCallToIcu(call!);

    expect(result.icu).toContain('one {You have # message}');
    expect(result.icu).toContain('other {You have # messages}');
  });

  it('escapes ICU special characters in forms', () => {
    const call = parsePluralCall(`
      plural(count, { one: "{count} item", other: "{count} items" })
    `);

    const result = serializePluralCallToIcu(call!);

    // Curly braces in the form text should be escaped
    expect(result.icu).toContain("one {'{count}' item}");
  });

  it('throws for missing value argument', () => {
    const call = parsePluralCall(`
      plural({ one: "# item", other: "# items" })
    `);

    expect(() => serializePluralCallToIcu(call!)).toThrow(
      'plural() requires a value as first argument',
    );
  });

  it('throws for missing forms object', () => {
    const call = parsePluralCall(`
      plural(count)
    `);

    expect(() => serializePluralCallToIcu(call!)).toThrow(
      'plural() requires a forms object as second argument',
    );
  });

  it('throws for missing other form', () => {
    const call = parsePluralCall(`
      plural(count, { one: "# item" })
    `);

    expect(() => serializePluralCallToIcu(call!)).toThrow(
      'plural() requires an "other" form',
    );
  });

  it('throws for non-literal form values', () => {
    const call = parsePluralCall(`
      plural(count, { one: someVar, other: "# items" })
    `);

    expect(() => serializePluralCallToIcu(call!)).toThrow(
      'plural() form values must be string literals',
    );
  });
});
