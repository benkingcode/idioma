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
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return;
  }
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}
