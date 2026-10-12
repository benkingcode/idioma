import { promises as fs } from 'fs';
import { isAbsolute, join } from 'path';
import * as babel from '@babel/core';
import { describe, expect, it, vi } from 'vitest';
import { extractFromFile } from './extract';

// Issue #11. The presets used to be passed to Babel by bare name, which Babel
// resolves from the consumer's cwd. An app that does not install
// @babel/preset-react itself then got "Cannot find package" for every file,
// and extract reported 0 messages with exit code 0.
//
// A cwd-based repro (process.chdir into an empty temp dir) cannot catch this:
// under Vitest, Babel finds the preset from its own location whatever the
// cwd, so that test passes with or without the bug. So these tests check the
// cause instead: what extract hands to Babel, and what the package declares.
vi.mock('@babel/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@babel/core')>();
  return { ...actual, transformAsync: vi.fn(actual.transformAsync) };
});

describe('extract babel presets', () => {
  it('passes the presets to Babel as resolved paths, not bare names', async () => {
    const idiomaDir = join('/project', 'src', 'idioma');
    const messages = await extractFromFile(
      `
      import { Trans } from './idioma'
      export const App = () => <Trans>Hello world</Trans>
      `,
      join('/project', 'src', 'App.tsx'),
      'src/App.tsx',
      idiomaDir,
    );

    expect(messages.map((m) => m.source)).toEqual(['Hello world']);

    const options = vi.mocked(babel.transformAsync).mock.calls[0][1];
    const presetPaths = (options?.presets ?? []).map((preset) =>
      Array.isArray(preset) ? preset[0] : preset,
    );
    expect(presetPaths).toHaveLength(2);
    for (const path of presetPaths) {
      expect(typeof path).toBe('string');
      expect(isAbsolute(path as string)).toBe(true);
    }
  });

  it('declares the presets as runtime dependencies', async () => {
    const pkg = JSON.parse(
      await fs.readFile(
        new URL('../../../package.json', import.meta.url),
        'utf-8',
      ),
    );

    expect(pkg.dependencies).toHaveProperty('@babel/preset-react');
    expect(pkg.dependencies).toHaveProperty('@babel/preset-typescript');
  });
});
