const warned = new Set<string>();

/**
 * Warn once per key, in development only, that a t() or Trans call reached
 * the runtime without being inlined, so it renders its id. The Babel plugin
 * fails the build for most such calls (issue #14); this covers the rest, such
 * as a file the plugin never transformed. It used to warn on every render,
 * in production too, or (for createT) not at all.
 *
 * @internal Used by @idioma/react and the plain createT.
 */
export function _warnNotInlined(key: string, message: string): void {
  // Bare process.env.NODE_ENV, as in Trans.tsx and useT.ts: bundlers replace
  // it with a string, so production builds drop this branch. A
  // `typeof process` guard would stay in the bundle, and in a browser (no
  // process) it would let the warning run in production.
  if (process.env.NODE_ENV === 'production') return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}
