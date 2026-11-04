import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

// Idioma transforms and extracts with Oxc (#20). An app must not need any
// Babel package for it: an undeclared Babel preset once made every extract
// find 0 messages (#11). Babel stays a devDependency, as the tests' oracle.
describe('@idioma/core', () => {
  it('has no Babel runtime or peer dependency', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as Record<string, Record<string, string> | undefined>;
    const runtime = Object.keys({
      ...pkg.dependencies,
      ...pkg.peerDependencies,
    });
    expect(runtime.filter((name) => /babel/.test(name))).toEqual([]);
  });

  it('exports no Babel plugin or preset', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(pkg.exports).filter((key) => /babel/.test(key))).toEqual(
      [],
    );
  });
});
