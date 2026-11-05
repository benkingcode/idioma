/**
 * What @idioma/ai uses from core. Not a public API: it can change in any
 * release. @idioma/ai ships in lockstep with core and peer-depends on the
 * exact same version, so the two always agree on it.
 *
 * @internal
 * @packageDocumentation
 */
export { ensureExtracted } from './cli/commands/ensure-extracted.js';
export { extractFromFile } from './cli/commands/extract.js';
export type { TranslateCommandArgs } from './cli/commands/translate-command.js';
export { getIdiomaPaths, loadConfig, type IdiomaConfig } from './cli/config.js';
export {
  colors,
  createAnimatedHeader,
  setNonInteractive,
} from './cli/ui/index.js';
export { loadPoFile, writePoFile } from './po/parser.js';
export type { Catalog, Message, PoFormatOptions } from './po/types.js';
