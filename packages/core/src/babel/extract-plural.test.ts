import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';
import {
  serializePluralCallToIcu,
  serializeSelectCallToIcu,
  serializeSelectOrdinalCallToIcu,
} from './extract-plural';

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

/**
 * Helper to parse a select() function call from code.
 */
function parseSelectCall(code: string): t.CallExpression | null {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let callExpr: t.CallExpression | null = null;

  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee) &&
        path.node.callee.name === 'select'
      ) {
        callExpr = path.node;
        path.stop();
      }
    },
  });

  return callExpr;
}

describe('serializeSelectCallToIcu', () => {
  it('converts simple select() call to ICU', () => {
    const call = parseSelectCall(`
      select(gender, { male: "He", female: "She", other: "They" })
    `);

    const result = serializeSelectCallToIcu(call!);

    expect(result.icu).toBe(
      '{gender, select, male {He} female {She} other {They}}',
    );
    expect(result.variable).toBe('gender');
  });

  it('converts select() call with many options', () => {
    const call = parseSelectCall(`
      select(status, {
        pending: "Waiting",
        approved: "Accepted",
        rejected: "Denied",
        other: "Unknown"
      })
    `);

    const result = serializeSelectCallToIcu(call!);

    expect(result.icu).toContain('{status, select,');
    expect(result.icu).toContain('pending {Waiting}');
    expect(result.icu).toContain('approved {Accepted}');
    expect(result.icu).toContain('rejected {Denied}');
    expect(result.icu).toContain('other {Unknown}}');
    expect(result.variable).toBe('status');
  });

  it('handles member expression value', () => {
    const call = parseSelectCall(`
      select(user.gender, { male: "He", female: "She", other: "They" })
    `);

    const result = serializeSelectCallToIcu(call!);

    expect(result.icu).toBe(
      '{user.gender, select, male {He} female {She} other {They}}',
    );
    expect(result.variable).toBe('user.gender');
  });

  it('throws for missing value argument', () => {
    const call = parseSelectCall(`
      select({ male: "He", female: "She", other: "They" })
    `);

    expect(() => serializeSelectCallToIcu(call!)).toThrow(
      'select() requires a value as first argument',
    );
  });

  it('throws for missing forms object', () => {
    const call = parseSelectCall(`
      select(gender)
    `);

    expect(() => serializeSelectCallToIcu(call!)).toThrow(
      'select() requires a forms object as second argument',
    );
  });

  it('throws for missing other form', () => {
    const call = parseSelectCall(`
      select(gender, { male: "He", female: "She" })
    `);

    expect(() => serializeSelectCallToIcu(call!)).toThrow(
      'select() requires an "other" form',
    );
  });

  it('throws for non-literal form values', () => {
    const call = parseSelectCall(`
      select(gender, { male: someVar, other: "They" })
    `);

    expect(() => serializeSelectCallToIcu(call!)).toThrow(
      'select() form values must be string literals',
    );
  });
});

/**
 * Helper to parse a selectOrdinal() function call from code.
 */
function parseSelectOrdinalCall(code: string): t.CallExpression | null {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let callExpr: t.CallExpression | null = null;

  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee) &&
        path.node.callee.name === 'selectOrdinal'
      ) {
        callExpr = path.node;
        path.stop();
      }
    },
  });

  return callExpr;
}

describe('serializeSelectOrdinalCallToIcu', () => {
  it('converts simple selectOrdinal() call to ICU', () => {
    const call = parseSelectOrdinalCall(`
      selectOrdinal(place, { one: "#st", two: "#nd", few: "#rd", other: "#th" })
    `);

    const result = serializeSelectOrdinalCallToIcu(call!);

    expect(result.icu).toBe(
      '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
    );
    expect(result.variable).toBe('place');
  });

  it('converts selectOrdinal() call with all forms', () => {
    const call = parseSelectOrdinalCall(`
      selectOrdinal(n, {
        zero: "zeroth",
        one: "first",
        two: "second",
        few: "third",
        many: "manyth",
        other: "nth"
      })
    `);

    const result = serializeSelectOrdinalCallToIcu(call!);

    expect(result.icu).toBe(
      '{n, selectordinal, zero {zeroth} one {first} two {second} few {third} many {manyth} other {nth}}',
    );
    expect(result.variable).toBe('n');
  });

  it('handles member expression value', () => {
    const call = parseSelectOrdinalCall(`
      selectOrdinal(data.position, { one: "#st", other: "#th" })
    `);

    const result = serializeSelectOrdinalCallToIcu(call!);

    expect(result.icu).toBe(
      '{data.position, selectordinal, one {#st} other {#th}}',
    );
    expect(result.variable).toBe('data.position');
  });

  it('throws for missing value argument', () => {
    const call = parseSelectOrdinalCall(`
      selectOrdinal({ one: "#st", other: "#th" })
    `);

    expect(() => serializeSelectOrdinalCallToIcu(call!)).toThrow(
      'selectOrdinal() requires a value as first argument',
    );
  });

  it('throws for missing forms object', () => {
    const call = parseSelectOrdinalCall(`
      selectOrdinal(place)
    `);

    expect(() => serializeSelectOrdinalCallToIcu(call!)).toThrow(
      'selectOrdinal() requires a forms object as second argument',
    );
  });

  it('throws for missing other form', () => {
    const call = parseSelectOrdinalCall(`
      selectOrdinal(place, { one: "#st" })
    `);

    expect(() => serializeSelectOrdinalCallToIcu(call!)).toThrow(
      'selectOrdinal() requires an "other" form',
    );
  });

  it('throws for non-literal form values', () => {
    const call = parseSelectOrdinalCall(`
      selectOrdinal(place, { one: someVar, other: "#th" })
    `);

    expect(() => serializeSelectOrdinalCallToIcu(call!)).toThrow(
      'selectOrdinal() form values must be string literals',
    );
  });
});
