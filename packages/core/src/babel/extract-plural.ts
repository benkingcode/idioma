import _generate from '@babel/generator';
import * as t from '@babel/types';

// Handle ESM/CJS interop for @babel/generator
const generate =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: typeof _generate }).default;

export interface PluralIcuResult {
  /** The ICU plural message */
  icu: string;
  /** The variable name used for the count */
  variable: string;
}

// Valid plural form names in order
const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
type PluralForm = (typeof PLURAL_FORMS)[number];

/**
 * Serialize a plural() function call to ICU MessageFormat.
 *
 * Converts:
 *   plural(count, { one: "# item", other: "# items" })
 * To:
 *   {count, plural, one {# item} other {# items}}
 *
 * This is the shared implementation used by both Trans and t() extraction.
 */
export function serializePluralCallToIcu(
  call: t.CallExpression,
): PluralIcuResult {
  const args = call.arguments;

  // Validate first argument (value)
  if (args.length < 1 || t.isObjectExpression(args[0])) {
    throw new Error('plural() requires a value as first argument');
  }

  // Validate second argument (forms object)
  if (args.length < 2 || !t.isObjectExpression(args[1])) {
    throw new Error('plural() requires a forms object as second argument');
  }

  // Extract the variable expression
  // We've already validated args[0] is not an ObjectExpression above
  const valueArg = args[0] as t.Expression;
  const variable = generate(valueArg).code;

  // Extract plural forms from the object
  const formsObj = args[1] as t.ObjectExpression;
  const props = new Map<string, string>();

  for (const prop of formsObj.properties) {
    if (!t.isObjectProperty(prop)) continue;

    // Get the property key
    let keyName: string | null = null;
    if (t.isIdentifier(prop.key)) {
      keyName = prop.key.name;
    } else if (t.isStringLiteral(prop.key)) {
      keyName = prop.key.value;
    }

    if (!keyName || !PLURAL_FORMS.includes(keyName as PluralForm)) continue;

    // Get the property value (must be a string literal)
    if (t.isStringLiteral(prop.value)) {
      props.set(keyName, prop.value.value);
    } else {
      throw new Error('plural() form values must be string literals');
    }
  }

  // Validate required 'other' form
  if (!props.has('other')) {
    throw new Error('plural() requires an "other" form');
  }

  // Build ICU message (same logic as serializePluralToIcu)
  const forms: string[] = [];

  for (const form of PLURAL_FORMS) {
    if (props.has(form)) {
      const formText = escapeIcuSpecialChars(props.get(form)!);
      forms.push(`${form} {${formText}}`);
    }
  }

  const icu = `{${variable}, plural, ${forms.join(' ')}}`;

  return { icu, variable };
}

/**
 * Escape special ICU characters in form text.
 * Curly braces { and } need to be escaped as '{' and '}' in ICU.
 * But # should NOT be escaped as it's a special ICU placeholder.
 */
function escapeIcuSpecialChars(text: string): string {
  // Escape { and } but not #
  return text.replace(/\{/g, "'{").replace(/\}/g, "}'");
}

export interface SelectIcuResult {
  /** The ICU select message */
  icu: string;
  /** The variable name used for selection */
  variable: string;
}

/**
 * Serialize a select() function call to ICU MessageFormat.
 *
 * Converts:
 *   select(gender, { male: "He", female: "She", other: "They" })
 * To:
 *   {gender, select, male {He} female {She} other {They}}
 */
export function serializeSelectCallToIcu(
  call: t.CallExpression,
): SelectIcuResult {
  const args = call.arguments;

  // Validate first argument (value)
  if (args.length < 1 || t.isObjectExpression(args[0])) {
    throw new Error('select() requires a value as first argument');
  }

  // Validate second argument (forms object)
  if (args.length < 2 || !t.isObjectExpression(args[1])) {
    throw new Error('select() requires a forms object as second argument');
  }

  // Extract the variable expression
  const valueArg = args[0] as t.Expression;
  const variable = generate(valueArg).code;

  // Extract select forms from the object
  const formsObj = args[1] as t.ObjectExpression;
  const props = new Map<string, string>();

  for (const prop of formsObj.properties) {
    if (!t.isObjectProperty(prop)) continue;

    // Get the property key
    let keyName: string | null = null;
    if (t.isIdentifier(prop.key)) {
      keyName = prop.key.name;
    } else if (t.isStringLiteral(prop.key)) {
      keyName = prop.key.value;
    }

    if (!keyName) continue;

    // Get the property value (must be a string literal)
    if (t.isStringLiteral(prop.value)) {
      props.set(keyName, prop.value.value);
    } else {
      throw new Error('select() form values must be string literals');
    }
  }

  // Validate required 'other' form
  if (!props.has('other')) {
    throw new Error('select() requires an "other" form');
  }

  // Build ICU message - put 'other' last for consistency
  const forms: string[] = [];

  for (const [key, value] of props.entries()) {
    if (key !== 'other') {
      const formText = escapeIcuSpecialChars(value);
      forms.push(`${key} {${formText}}`);
    }
  }

  // Add 'other' last
  forms.push(`other {${escapeIcuSpecialChars(props.get('other')!)}}`);

  const icu = `{${variable}, select, ${forms.join(' ')}}`;

  return { icu, variable };
}

/**
 * Serialize a selectOrdinal() function call to ICU MessageFormat.
 *
 * Converts:
 *   selectOrdinal(place, { one: "#st", two: "#nd", few: "#rd", other: "#th" })
 * To:
 *   {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}
 */
export function serializeSelectOrdinalCallToIcu(
  call: t.CallExpression,
): PluralIcuResult {
  const args = call.arguments;

  // Validate first argument (value)
  if (args.length < 1 || t.isObjectExpression(args[0])) {
    throw new Error('selectOrdinal() requires a value as first argument');
  }

  // Validate second argument (forms object)
  if (args.length < 2 || !t.isObjectExpression(args[1])) {
    throw new Error(
      'selectOrdinal() requires a forms object as second argument',
    );
  }

  // Extract the variable expression
  const valueArg = args[0] as t.Expression;
  const variable = generate(valueArg).code;

  // Extract plural forms from the object
  const formsObj = args[1] as t.ObjectExpression;
  const props = new Map<string, string>();

  for (const prop of formsObj.properties) {
    if (!t.isObjectProperty(prop)) continue;

    // Get the property key
    let keyName: string | null = null;
    if (t.isIdentifier(prop.key)) {
      keyName = prop.key.name;
    } else if (t.isStringLiteral(prop.key)) {
      keyName = prop.key.value;
    }

    if (!keyName || !PLURAL_FORMS.includes(keyName as PluralForm)) continue;

    // Get the property value (must be a string literal)
    if (t.isStringLiteral(prop.value)) {
      props.set(keyName, prop.value.value);
    } else {
      throw new Error('selectOrdinal() form values must be string literals');
    }
  }

  // Validate required 'other' form
  if (!props.has('other')) {
    throw new Error('selectOrdinal() requires an "other" form');
  }

  // Build ICU message
  const forms: string[] = [];

  for (const form of PLURAL_FORMS) {
    if (props.has(form)) {
      const formText = escapeIcuSpecialChars(props.get(form)!);
      forms.push(`${form} {${formText}}`);
    }
  }

  const icu = `{${variable}, selectordinal, ${forms.join(' ')}}`;

  return { icu, variable };
}
