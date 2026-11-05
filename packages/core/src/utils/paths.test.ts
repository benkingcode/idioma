import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { isInsideDir } from './paths';

describe('isInsideDir', () => {
  const dir = resolve('/app/src/idioma');

  it('is true for the folder itself', () => {
    expect(isInsideDir(dir, dir)).toBe(true);
  });

  it('is true for a path inside the folder', () => {
    expect(isInsideDir(join(dir, 'plain.ts'), dir)).toBe(true);
    expect(isInsideDir(join(dir, 'locales', 'en.po'), dir)).toBe(true);
  });

  it('is false for a sibling whose name starts the same', () => {
    // A bare startsWith took ../idioma-legacy for the idioma folder
    expect(isInsideDir(resolve('/app/src/idioma-legacy'), dir)).toBe(false);
    expect(isInsideDir(resolve('/app/src/idiomas/x.ts'), dir)).toBe(false);
  });

  it('is false for a parent or an unrelated path', () => {
    expect(isInsideDir(resolve('/app/src'), dir)).toBe(false);
    expect(isInsideDir(resolve('/other/idioma'), dir)).toBe(false);
  });
});
