import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { cleanJsxText, decodeJsxEntities } from './jsx-text.js';

// Babel is the oracle: the message text and keys in existing catalogues were
// made by Babel's JSX parser and its `react.buildChildren`, so the Oxc path
// must give the same strings for every text child.
function babelTextChildren(source: string): string[] {
  const ast = babelParse(source, { plugins: ['jsx'], sourceType: 'module' });
  const statement = ast.program.body[0] as t.ExpressionStatement;
  const element = statement.expression as t.JSXElement;
  return t.react
    .buildChildren(element)
    .filter((node): node is t.StringLiteral => t.isStringLiteral(node))
    .map((node) => node.value);
}

function oxcTextChildren(source: string): string[] {
  const { program } = parseSync('test.jsx', source, {
    lang: 'jsx',
    preserveParens: false,
  });
  const statement = program.body[0] as { expression: { children: unknown[] } };
  const texts: string[] = [];
  for (const child of statement.expression.children as {
    type: string;
    value?: string;
  }[]) {
    if (child.type !== 'JSXText') continue;
    const cleaned = cleanJsxText(decodeJsxEntities(child.value!, true));
    if (cleaned !== null) texts.push(cleaned);
  }
  return texts;
}

const CASES: Record<string, string> = {
  plain: '<a>Hello world</a>',
  'named entities': '<a>A &amp; B&nbsp;C &copy; &lt;x&gt; &hellip;</a>',
  'numeric entities': '<a>&#169; &#xA9; &#x1F3A7; &#65;</a>',
  'unknown entity stays literal': '<a>&notanentity; &constructor; &amp</a>',
  'leading and trailing spaces': '<a>  padded  </a>',
  'multi-line text': '<a>\n  First line\n  second line\n</a>',
  'blank lines inside': '<a>\n  One\n\n\n  Two\n</a>',
  'tabs and spaces': '<a>\tTabbed\t text\t</a>',
  'CRLF line endings': '<a>\r\n  Windows\r\n  lines\r\n</a>',
  'only whitespace': '<a>\n   \n</a>',
  'text around an expression': '<a>\n  Hello {name},\n  welcome back\n</a>',
  'text around an element': '<a>Click <b>here</b> now</a>',
  'non-breaking space at edges': '<a>&nbsp;Edge&nbsp;</a>',
  'emoji and accents': '<a>🎧 Café — déjà vu</a>',
};

describe('JSX text, as Babel reads it', () => {
  for (const [name, source] of Object.entries(CASES)) {
    it(name, () => {
      expect(oxcTextChildren(source)).toEqual(babelTextChildren(source));
    });
  }
});

describe('decodeJsxEntities', () => {
  it('keeps CRLF in an attribute string', () => {
    expect(decodeJsxEntities('a\r\nb', false)).toBe('a\r\nb');
  });

  it('turns CRLF into LF in JSX text', () => {
    expect(decodeJsxEntities('a\r\nb', true)).toBe('a\nb');
  });
});
