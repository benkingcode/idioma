import { isAbsolute, relative } from 'path';

/**
 * Whether a path is a folder or inside it. A bare `startsWith` took a
 * sibling whose name starts the same (`src/idioma-legacy`) for the idioma
 * folder `src/idioma`.
 */
export function isInsideDir(path: string, dir: string): boolean {
  const rel = relative(dir, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
