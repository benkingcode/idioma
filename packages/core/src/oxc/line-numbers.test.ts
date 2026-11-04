import MagicString from 'magic-string';
import { describe, expect, it } from 'vitest';
import { transformModule, type TransformOptions } from './transform.js';

// Metro hands the transform's output to the app's Babel transformer with no
// source map, so every line of the source must stay on its line: else stack
// traces and breakpoints in React Native point at the wrong line.

const FILENAME = '/project/src/App.tsx';
const OPTIONS: TransformOptions = {
  mode: 'inlined',
  idiomaDir: '/project/src/idioma',
  translations: {
    'items.count': { en: '{count} items', es: '{count} artículos' },
    'set.live': { en: 'Live now', es: 'En directo' },
    'set.past': { en: 'Played', es: 'Tocado' },
  },
};

/** The output, and the original code it moved to another line. */
function transformLines(code: string, options = OPTIONS) {
  const edits = new MagicString(code);
  const result = transformModule(code, FILENAME, options, edits);
  let moved = 0;
  let previous = '';
  edits
    .generateDecodedMap({ hires: true })
    .mappings.forEach((segments, line) => {
      for (const segment of segments) {
        if (segment.length < 4) continue;
        // Each later line of an edit repeats the edit's start: that is new
        // text, not original code that moved
        const position = `${segment[2]}:${segment[3]}`;
        if (position !== previous && segment[2] !== line) moved++;
        previous = position;
      }
    });
  return { code: result.code, moved };
}

const lineCount = (code: string) => code.split('\n').length;

describe('the transform keeps every line on its line', () => {
  it('for a multi-line <Trans>, and the import it adds', () => {
    const code = `'use client';
import { Trans } from './idioma';
export const A = ({ name }) => (
  <p>
    <Trans>
      Hello {name}, read
      <a href="/terms">the terms</a>
    </Trans>
  </p>
);
export const after = 1;
`;
    const { code: output, moved } = transformLines(code);

    expect(output).toContain('<__Trans');
    expect(lineCount(output)).toBe(lineCount(code));
    expect(moved).toBe(0);
  });

  it('for a multi-line object t() call', () => {
    const code = `import { useT } from './idioma';
export function B({ count }) {
  const t = useT();
  return t({
    id: 'items.count',
    source: '{count} items',
    values: { count },
  });
}
export const after = 1;
`;
    const { code: output, moved } = transformLines(code);

    expect(output).toContain('artículos');
    expect(lineCount(output)).toBe(lineCount(code));
    expect(moved).toBe(0);
  });

  it('for a conditional id, on t() and on <Trans>', () => {
    const code = `import { Trans, useT } from './idioma';
export function C({ live, name }) {
  const t = useT();
  const label = t({
    id: live ? 'set.live' : 'set.past',
    values: { name },
  });
  return (
    <Trans
      id={live ? 'set.live' : 'set.past'}
    />
  );
}
export const after = 1;
`;
    const { code: output, moved } = transformLines(code);

    expect(output).toContain('En directo');
    expect(lineCount(output)).toBe(lineCount(code));
    expect(moved).toBe(0);
  });

  it('for the loaders that suspense mode adds', () => {
    const code = `import { Trans } from './idioma';
export const D = () => (
  <Trans>
    Hello
  </Trans>
);
export const after = 1;
`;
    const { code: output, moved } = transformLines(code, {
      mode: 'suspense',
      idiomaDir: '/project/src/idioma',
      locales: ['en', 'es'],
      outputDir: 'src/idioma',
      projectRoot: '/project',
    });

    expect(output).toContain('__$idiomaLoad');
    expect(lineCount(output)).toBe(lineCount(code));
    expect(moved).toBe(0);
  });
});
