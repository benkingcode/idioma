import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { transformModule, type Translations } from '../oxc/transform.js';
import {
  loadPathsMatcher,
  type PathsMatcher,
} from '../utils/resolve-tsconfig-paths.js';

/**
 * Metro's `babelTransformerPath` for Idioma (#20): runs the Oxc transform on
 * a module, then hands the result to the app's own Babel transformer (Expo's
 * or React Native's). `withIdioma` sets it, and passes what it needs through
 * the environment, because Metro gives a transformer only the module, and
 * starts its workers after the config has loaded.
 */

/** The app's own Babel transformer, which this one wraps */
export const UPSTREAM_ENV = 'IDIOMA_METRO_UPSTREAM_TRANSFORMER';
/** The Idioma options, as JSON */
export const OPTIONS_ENV = 'IDIOMA_METRO_OPTIONS';
/** This module's path, for `babelTransformerPath` */
export const transformerPath = fileURLToPath(import.meta.url);

export interface MetroTransformerOptions {
  /** The idioma folder, relative to the project root */
  idiomaDir: string;
  /**
   * The project root `withIdioma` compiled the catalogue in. Metro may call
   * `getCacheKey` with no project root, and then a cwd-relative path would
   * hash a missing catalogue and serve stale copy after a restart.
   */
  projectRoot?: string;
  useSuspense?: boolean;
  locales?: string[];
}

interface BabelTransformerArgs {
  src: string;
  filename: string;
  options: { projectRoot: string };
  [key: string]: unknown;
}

interface BabelTransformer {
  transform(args: BabelTransformerArgs): unknown;
  getCacheKey?(...args: unknown[]): string;
}

// The modules that can hold something to transform, as in the Vite plugin.
const SCRIPT = /\.[cm]?[jt]sx?$/;
const CODE_FILTER = /\bTrans\b|\buseT\b|\bcreateT\b|\bt\s*\(/;

const require = createRequire(import.meta.url);

function upstream(): BabelTransformer {
  const path = process.env[UPSTREAM_ENV];
  if (!path) {
    throw new Error(
      `[idioma] ${UPSTREAM_ENV} is not set: wrap the Metro config with withIdioma().`,
    );
  }
  const module = require(path) as BabelTransformer & {
    default?: BabelTransformer;
  };
  return module.default ?? module;
}

function readOptions(): MetroTransformerOptions {
  const json = process.env[OPTIONS_ENV];
  if (!json) {
    throw new Error(
      `[idioma] ${OPTIONS_ENV} is not set: wrap the Metro config with withIdioma().`,
    );
  }
  return JSON.parse(json) as MetroTransformerOptions;
}

function translationsFile(projectRoot: string, idiomaDir: string): string {
  return join(resolve(projectRoot, idiomaDir), '.generated', 'translations.js');
}

interface WorkerState {
  options: MetroTransformerOptions;
  idiomaDir: string;
  translations: Translations | undefined;
  pathsMatcher: PathsMatcher | undefined;
}

let state: Promise<WorkerState> | undefined;

async function loadState(projectRoot: string): Promise<WorkerState> {
  const options = readOptions();
  const idiomaDir = resolve(projectRoot, options.idiomaDir);
  let translations: Translations | undefined;
  if (!options.useSuspense) {
    const file = translationsFile(projectRoot, options.idiomaDir);
    if (existsSync(file)) {
      const module = (await import(pathToFileURL(file).href)) as {
        translations: Translations;
      };
      translations = module.translations;
    }
  }
  return {
    options,
    idiomaDir,
    translations,
    pathsMatcher: loadPathsMatcher(projectRoot) ?? undefined,
  };
}

export async function transform(args: BabelTransformerArgs): Promise<unknown> {
  const { projectRoot } = args.options;
  const filename = resolve(projectRoot, args.filename);
  let src = args.src;
  if (
    SCRIPT.test(filename) &&
    !filename.includes('/node_modules/') &&
    CODE_FILTER.test(src)
  ) {
    state ??= loadState(projectRoot);
    const { options, idiomaDir, translations, pathsMatcher } = await state;
    src = transformModule(src, filename, {
      mode: options.useSuspense ? 'suspense' : 'inlined',
      translations,
      idiomaDir,
      pathsMatcher,
      locales: options.locales,
      outputDir: options.idiomaDir,
      projectRoot,
    }).code;
  }
  return upstream().transform({ ...args, src });
}

/**
 * The upstream key, plus the catalogue: the output inlines it, so a module
 * Metro cached must be transformed again when the catalogue changes.
 */
export function getCacheKey(...args: unknown[]): string {
  const first = args[0] as { projectRoot?: string } | undefined;
  const options = readOptions();
  const projectRoot = options.projectRoot ?? first?.projectRoot ?? '';
  const file = translationsFile(projectRoot, options.idiomaDir);
  const catalogue = existsSync(file) ? readFileSync(file) : '';
  const hash = createHash('sha256')
    .update(catalogue)
    .update(JSON.stringify(options))
    .digest('hex');
  return [upstream().getCacheKey?.(...args) ?? '', hash].join('$');
}
