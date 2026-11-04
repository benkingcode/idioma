import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  getCacheKey,
  OPTIONS_ENV,
  transform,
  UPSTREAM_ENV,
} from './metro-transformer';

// A project with a compiled catalogue, and a stand-in for the app's own Babel
// transformer that returns what it was given.
let projectRoot: string;
let translationsPath: string;

beforeAll(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'idioma-metro-'));
  mkdirSync(join(projectRoot, 'src/idioma/.generated'), { recursive: true });
  translationsPath = join(projectRoot, 'src/idioma/.generated/translations.js');
  writeFileSync(
    translationsPath,
    'export const translations = { greeting: { en: "Hello", es: "Hola" } };\n',
  );
  const upstream = join(projectRoot, 'upstream-transformer.cjs');
  writeFileSync(
    upstream,
    'module.exports = { transform: (args) => ({ ast: null, received: args }),' +
      ' getCacheKey: () => "upstream" };\n',
  );
  process.env[UPSTREAM_ENV] = upstream;
  process.env[OPTIONS_ENV] = JSON.stringify({ idiomaDir: 'src/idioma' });
});

const app = `
  import { Trans } from './idioma';
  export const App = () => <Trans id="greeting">Hello</Trans>;
`;

describe('Idioma Metro transformer', () => {
  it("transforms with Idioma, then hands the code to the app's transformer", async () => {
    const result = (await transform({
      src: app,
      filename: 'src/App.tsx',
      options: { projectRoot },
    })) as { received: { src: string; filename: string } };

    expect(result.received.filename).toBe('src/App.tsx');
    expect(result.received.src).toContain('<__Trans __t={');
    expect(result.received.src).toContain('"es": "Hola"');
  });

  it('leaves node_modules to the upstream transformer, untouched', async () => {
    const result = (await transform({
      src: app,
      filename: 'node_modules/lib/App.tsx',
      options: { projectRoot },
    })) as { received: { src: string } };

    expect(result.received.src).toBe(app);
  });

  it('changes its cache key when the catalogue changes', () => {
    const before = getCacheKey({ projectRoot });
    writeFileSync(
      translationsPath,
      'export const translations = { greeting: { en: "Hi", es: "Hola" } };\n',
    );
    const after = getCacheKey({ projectRoot });

    expect(before).toContain('upstream');
    expect(after).not.toBe(before);
  });
});
