import { dirname, resolve } from 'path';
import {
  isAliasedIdiomaImport,
  type PathsMatcher,
} from '../utils/resolve-tsconfig-paths.js';

/**
 * Detect whether a source file imports anything from the user's idioma
 * directory. Mirrors the babel plugin's import-resolution logic so that
 * any file this returns `false` for would also produce zero extractions
 * if handed to babel.
 *
 * Cheap by design: a regex scan over the source text, no AST parse. False
 * positives (e.g., matches inside comments or string literals) are acceptable
 * — they only cost one no-op extraction cycle, which the downstream
 * writeIfChanged guard then swallows.
 */
export function fileImportsIdioma(
  content: string,
  filePath: string,
  idiomaDir: string,
  pathsMatcher: PathsMatcher | null,
): boolean {
  const re = /\b(?:from|import)\b\s*\(?\s*['"]([^'"]+)['"]/g;
  const fileDir = dirname(filePath);

  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const spec = match[1];
    if (!spec) continue;
    if (spec.startsWith('.')) {
      const resolved = resolve(fileDir, spec);
      if (resolved.startsWith(idiomaDir)) {
        return true;
      }
    } else if (pathsMatcher) {
      if (isAliasedIdiomaImport(spec, idiomaDir, pathsMatcher)) {
        return true;
      }
    }
  }
  return false;
}
