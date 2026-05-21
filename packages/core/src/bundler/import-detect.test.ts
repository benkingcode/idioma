import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { PathsMatcher } from '../utils/resolve-tsconfig-paths';
import { fileImportsIdioma } from './import-detect';

const PROJ = resolve('/proj');
const IDIOMA_DIR = resolve(PROJ, 'src/idioma');
const FILE = resolve(PROJ, 'src/components/Foo.tsx');

describe('fileImportsIdioma', () => {
  it('returns false for empty content', () => {
    expect(fileImportsIdioma('', FILE, IDIOMA_DIR, null)).toBe(false);
  });

  it('returns false when imports point elsewhere', () => {
    const content = [
      "import React from 'react';",
      "import { foo } from './utils';",
      "import '../styles/global.css';",
    ].join('\n');
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(false);
  });

  it('returns true for a relative idioma import', () => {
    const content = "import { Trans } from '../idioma';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(true);
  });

  it('returns true when the relative path goes up multiple levels', () => {
    const deepFile = resolve(PROJ, 'src/components/nested/deep/Foo.tsx');
    const content = "import { Trans } from '../../../idioma';";
    expect(fileImportsIdioma(content, deepFile, IDIOMA_DIR, null)).toBe(true);
  });

  it('returns true for a relative import into a subpath of idioma', () => {
    const content = "import { createT } from '../idioma/plain';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(true);
  });

  it('returns true when the imported name is aliased', () => {
    const content =
      "import { Trans as T, useT as useTranslate } from '../idioma';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(true);
  });

  it('returns true for a side-effect-only import', () => {
    const content = "import '../idioma';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(true);
  });

  it('returns true for a dynamic import resolving into idiomaDir', () => {
    const content = "const m = await import('../idioma');";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(true);
  });

  it('returns true when a path alias resolves into idiomaDir', () => {
    const matcher: PathsMatcher = (source) =>
      source === '@/idioma' ? [IDIOMA_DIR] : [];
    const content = "import { Trans } from '@/idioma';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, matcher)).toBe(true);
  });

  it('returns false when a path alias resolves outside idiomaDir', () => {
    const matcher: PathsMatcher = (source) =>
      source === '@/utils' ? [resolve(PROJ, 'src/utils')] : [];
    const content = "import { foo } from '@/utils';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, matcher)).toBe(false);
  });

  it('returns true for an export-from re-export of idioma', () => {
    const content = "export { Trans } from '../idioma';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(true);
  });

  it('matches inside comments (acceptable false positive, layer-2 catches it)', () => {
    // The simple regex doesn't strip comments. Acceptable: at worst we run
    // one unnecessary extraction, which then no-ops via writeIfChanged.
    const content = "// import { Trans } from '../idioma';";
    expect(fileImportsIdioma(content, FILE, IDIOMA_DIR, null)).toBe(true);
  });
});
