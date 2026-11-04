import type { CallExpression, ObjectExpression } from 'oxc-parser';
import { printExpression } from './print.js';

export interface IcuCallResult {
  /** The ICU message, for example `{count, plural, one {# item} other {# items}}` */
  icu: string;
  /** The text of the value argument, which becomes a placeholder */
  variable: string;
}

const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];

export type IcuCallName = 'plural' | 'select' | 'selectOrdinal';

export function isIcuCallName(name: string): name is IcuCallName {
  return name === 'plural' || name === 'select' || name === 'selectOrdinal';
}

/**
 * Serializes `plural(count, { one: '# item', other: '# items' })` and its
 * `select` and `selectOrdinal` siblings to ICU MessageFormat, with the same
 * rules and error messages as before.
 */
export function serializeIcuCall(
  name: IcuCallName,
  call: CallExpression,
  code: string,
): IcuCallResult {
  const [valueArg, formsArg] = call.arguments;
  if (!valueArg || valueArg.type === 'ObjectExpression') {
    throw new Error(`${name}() requires a value as first argument`);
  }
  if (!formsArg || formsArg.type !== 'ObjectExpression') {
    throw new Error(`${name}() requires a forms object as second argument`);
  }

  const variable = printExpression(valueArg, code);
  const props = readForms(name, formsArg);
  if (!props.has('other')) {
    throw new Error(`${name}() requires an "other" form`);
  }

  const forms: string[] = [];
  if (name === 'select') {
    for (const [key, value] of props) {
      if (key !== 'other') forms.push(`${key} {${escapeIcu(value)}}`);
    }
    forms.push(`other {${escapeIcu(props.get('other')!)}}`);
  } else {
    for (const form of PLURAL_FORMS) {
      if (props.has(form))
        forms.push(`${form} {${escapeIcu(props.get(form)!)}}`);
    }
  }

  const type = name === 'selectOrdinal' ? 'selectordinal' : name;
  return { icu: `{${variable}, ${type}, ${forms.join(' ')}}`, variable };
}

function readForms(
  name: IcuCallName,
  forms: ObjectExpression,
): Map<string, string> {
  const props = new Map<string, string>();
  for (const prop of forms.properties) {
    if (prop.type !== 'Property' || prop.method || prop.kind !== 'init') {
      continue;
    }
    const key =
      prop.key.type === 'Identifier'
        ? prop.key.name
        : prop.key.type === 'Literal' && typeof prop.key.value === 'string'
          ? prop.key.value
          : null;
    if (!key) continue;
    if (name !== 'select' && !PLURAL_FORMS.includes(key)) continue;
    if (prop.value.type === 'Literal' && typeof prop.value.value === 'string') {
      props.set(key, prop.value.value);
    } else {
      throw new Error(`${name}() form values must be string literals`);
    }
  }
  return props;
}

function escapeIcu(text: string): string {
  return text.replace(/\{/g, "'{").replace(/\}/g, "}'");
}
