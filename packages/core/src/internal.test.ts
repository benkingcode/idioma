import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import * as internal from './internal';

/**
 * @idioma/ai is a separate package, so what it uses from core goes through
 * one entry point, @idioma/core/internal, instead of deep imports into dist.
 */
describe('@idioma/core/internal', () => {
  it('exports what @idioma/ai needs from core', () => {
    for (const name of [
      'loadConfig',
      'getIdiomaPaths',
      'loadPoFile',
      'writePoFile',
      'extractFromFile',
      'ensureExtracted',
      'createAnimatedHeader',
      'setNonInteractive',
      'colors',
      'autoContextEnabled',
    ] as const) {
      expect(typeof internal[name], name).toBe('function');
    }
  });

  it('is in the package exports', () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '../package.json'), 'utf8'),
    );
    expect(manifest.exports['./internal']).toEqual({
      types: './dist/internal.d.mts',
      import: './dist/internal.mjs',
      require: './dist/internal.mjs',
    });
  });
});
