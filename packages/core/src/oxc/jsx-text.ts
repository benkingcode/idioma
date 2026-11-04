import { JSX_ENTITIES } from './jsx-entities.js';

// JSX text as Babel reads it. Every message text and hash key in existing
// catalogues came from Babel's JSX parser and its `react.buildChildren`, so
// these two functions reproduce @babel/parser 7.28.5 (`jsxReadToken`,
// `jsxReadEntity`) and @babel/types (`cleanJSXElementLiteralChild`) exactly.

/**
 * Decodes the character references in raw JSX text or a JSX attribute string,
 * as Babel's parser does: `&#65;`, `&#x41;` and the named ones in
 * JSX_ENTITIES. Anything else (`&notanentity;`, a bare `&`) stays as written.
 * JSX text also turns each CRLF into LF; an attribute string keeps it.
 */
export function decodeJsxEntities(
  raw: string,
  normalizeNewlines: boolean,
): string {
  let out = '';
  let pos = 0;
  while (pos < raw.length) {
    const ch = raw[pos];
    if (ch === '&') {
      const entity = readEntity(raw, pos + 1);
      if (entity) {
        out += entity.text;
        pos = entity.end;
      } else {
        out += '&';
        pos++;
      }
    } else if (normalizeNewlines && ch === '\r' && raw[pos + 1] === '\n') {
      out += '\n';
      pos += 2;
    } else {
      out += ch;
      pos++;
    }
  }
  return out;
}

/** The entity that starts after an `&` at `start`, and where it ends. */
function readEntity(
  raw: string,
  start: number,
): { text: string; end: number } | null {
  if (raw[start] === '#') {
    const hex = raw[start + 1] === 'x';
    const digitsStart = start + (hex ? 2 : 1);
    const digit = hex ? /[0-9a-fA-F]/ : /[0-9]/;
    let end = digitsStart;
    while (end < raw.length && digit.test(raw[end]!)) end++;
    if (end === digitsStart || raw[end] !== ';') return null;
    const codePoint = parseInt(raw.slice(digitsStart, end), hex ? 16 : 10);
    if (codePoint > 0x10ffff) return null;
    return { text: String.fromCodePoint(codePoint), end: end + 1 };
  }
  // Babel looks at most 10 characters ahead for the `;`.
  let end = start;
  for (let count = 0; count < 10 && end < raw.length; count++) {
    if (raw[end] === ';') {
      const name = raw.slice(start, end);
      return Object.hasOwn(JSX_ENTITIES, name)
        ? { text: JSX_ENTITIES[name]!, end: end + 1 }
        : null;
    }
    end++;
  }
  return null;
}

/**
 * Babel's `cleanJSXElementLiteralChild`: the string a JSX text child
 * renders, or null when it renders nothing. Leading whitespace goes from every
 * line but the first, trailing whitespace from every line but the last, blank
 * lines go, and the lines left join with one space.
 */
export function cleanJsxText(value: string): string | null {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/[^ \t]/.test(lines[i]!)) lastNonEmptyLine = i;
  }
  let str = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.replace(/\t/g, ' ');
    if (i !== 0) line = line.replace(/^ +/, '');
    if (i !== lines.length - 1) line = line.replace(/ +$/, '');
    if (line) {
      if (i !== lastNonEmptyLine) line += ' ';
      str += line;
    }
  }
  return str || null;
}
