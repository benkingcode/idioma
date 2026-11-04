import { parseSync, rawTransferSupported, type Program } from 'oxc-parser';

export type SourceLang = 'js' | 'jsx' | 'ts' | 'tsx';

export interface ParseOptions {
  lang: SourceLang;
  astType: 'ts';
  sourceType: 'module';
  /**
   * Off, as Babel's AST has no node for parentheses: `{(user.name)}` must
   * serialize as `{user.name}`, or a message and its key change.
   */
  preserveParens: false;
}

/**
 * A parser that returns the ESTree / TS-ESTree AST of oxc-parser. In Vite 8
 * this is Rolldown's `this.parse`, the same Oxc parser the bundler uses.
 */
export type ParseFn = (code: string, options: ParseOptions) => Program;

/** What a file is, from its extension. `.js` files may hold JSX, as in Babel. */
export function sourceLang(filename: string): SourceLang {
  const path = filename.split('?')[0]!;
  if (path.endsWith('.tsx')) return 'tsx';
  if (/\.[cm]?ts$/.test(path)) return 'ts';
  return 'jsx';
}

export function parseOptions(filename: string): ParseOptions {
  return {
    lang: sourceLang(filename),
    astType: 'ts',
    sourceType: 'module',
    preserveParens: false,
  };
}

// Raw transfer hands the AST to JavaScript as a buffer instead of JSON: on
// Dancefloor's 831 files, 39 ms against 139 ms (and 87 ms for Babel's parser),
// measured with oxc-parser 0.157.0. It needs a 64-bit platform, so it is used
// where oxc-parser says it works.
const RAW_TRANSFER = rawTransferSupported();

/** Parses with `parse` when given (Vite), else with oxc-parser. */
export function parseModule(
  code: string,
  filename: string,
  parse?: ParseFn,
): Program {
  const options = parseOptions(filename);
  if (parse) return parse(code, options);
  // A variable, not a literal: oxc-parser 0.157.0 documents and reads
  // `experimentalRawTransfer`, but its ParserOptions type does not list it.
  const rawOptions: ParseOptions & { experimentalRawTransfer: boolean } = {
    ...options,
    experimentalRawTransfer: RAW_TRANSFER,
  };
  const result = parseSync(filename, code, rawOptions);
  const error = result.errors[0];
  if (error) {
    throw new SyntaxError(`${filename}: ${error.message}`);
  }
  return result.program;
}

/**
 * The 1-based line of an offset. Line breaks are the ones Babel counts, so
 * `#:` references in the catalogue keep their line numbers.
 */
export function createLineLookup(code: string): (offset: number) => number {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i);
    if (ch === 10 || ch === 0x2028 || ch === 0x2029) {
      starts.push(i + 1);
    } else if (ch === 13) {
      if (code.charCodeAt(i + 1) === 10) i++;
      starts.push(i + 1);
    }
  }
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid]! <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}
