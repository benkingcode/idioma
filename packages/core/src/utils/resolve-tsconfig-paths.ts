import { createPathsMatcher, getTsconfig } from 'get-tsconfig';

/**
 * A function that resolves an import specifier against tsconfig paths.
 * Returns an array of possible absolute file paths, or empty array if no match.
 */
export type PathsMatcher = (specifier: string) => string[];

/**
 * Load a paths matcher from the tsconfig.json in the given directory.
 * Returns null if no tsconfig exists or no `compilerOptions.paths` are configured.
 */
export function loadPathsMatcher(projectRoot: string): PathsMatcher | null {
  const tsconfig = getTsconfig(projectRoot);
  if (!tsconfig) return null;
  return createPathsMatcher(tsconfig);
}

/**
 * Check if an import specifier resolves (via tsconfig path aliases)
 * to a path within the idioma directory.
 */
export function isAliasedIdiomaImport(
  source: string,
  idiomaDir: string,
  pathsMatcher: PathsMatcher,
): boolean {
  const resolved = pathsMatcher(source);
  if (!resolved || resolved.length === 0) return false;
  return resolved.some((p) => p.startsWith(idiomaDir));
}
