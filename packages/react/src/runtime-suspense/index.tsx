/**
 * Suspense-based runtime for @idioma/react.
 *
 * This module provides React components that use dynamic imports
 * and the React 19 `use()` hook for Suspense-based lazy loading.
 *
 * Requires React 19+.
 */

import {
  createContext,
  use,
  useContext,
  useMemo,
  version,
  type ReactNode,
} from 'react';
import {
  interpolateValues,
  renderMessage,
  type TransComponent,
} from '../interpolate';

// ============ React Version Check ============

const majorVersion = parseInt(version.split('.')[0]!, 10);

if (majorVersion < 19) {
  throw new Error(
    `[idioma] useSuspense mode requires React 19+. ` +
      `You're using React ${version}. ` +
      `Either upgrade React or set useSuspense: false.`,
  );
}

// ============ Types ============

type MessageFunction = (args: Record<string, unknown>) => string | ReactNode;
type MessageValue = string | MessageFunction;

type LoaderFn = () => Promise<{ default: Record<string, MessageValue> }>;
type Loader = Record<string, LoaderFn>;

interface SuspenseConfig {
  locales: readonly string[];
}

// ============ Promise Cache ============

const cache = new Map<string, Promise<Record<string, MessageValue>>>();

function getTranslations(
  locale: string,
  chunk: string,
  loader: Loader,
): Promise<Record<string, MessageValue>> {
  const key = `${locale}:${chunk}`;

  if (!cache.has(key)) {
    const promise = loader[locale]!().then((mod) => mod.default);
    cache.set(key, promise);
  }

  return cache.get(key)!;
}

/**
 * Preload translations for a locale/chunk combination.
 * Call this to warm the cache before rendering.
 */
export function preloadTranslations(
  locale: string,
  chunk: string,
  loader: Loader,
): void {
  getTranslations(locale, chunk, loader);
}

// ============ Context ============

export interface IdiomaContextValue {
  locale: string;
}

export const IdiomaContext = createContext<IdiomaContextValue | null>(null);

export interface IdiomaProviderProps {
  children: ReactNode;
  locale: string;
}

/**
 * Creates an IdiomaProvider for Suspense mode.
 * Same controlled API as the inlined runtime.
 */
export function createIdiomaProvider() {
  return function IdiomaProvider({ children, locale }: IdiomaProviderProps) {
    const value = useMemo(() => ({ locale }), [locale]);

    return (
      <IdiomaContext.Provider value={value}>{children}</IdiomaContext.Provider>
    );
  };
}

/**
 * Creates a useLocale hook that returns the current locale.
 */
export function createUseLocale() {
  return function useLocale(): string {
    const context = useContext(IdiomaContext);
    if (!context) {
      throw new Error(
        '[idioma] useLocale must be used within an IdiomaProvider. ' +
          'Make sure to wrap your app with <IdiomaProvider>.',
      );
    }
    return context.locale;
  };
}

// ============ Trans Component ============

/**
 * Props for Babel-transformed Trans in Suspense mode.
 */
export interface TransSuspenseProps {
  /** Translation key */
  __key: string;
  /** Chunk identifier */
  __chunk: string;
  /** Loader object with locale → dynamic import */
  __load: Loader;
  /** Arguments for interpolation */
  __a?: Record<string, unknown>;
  /** Components for tag interpolation */
  __c?: TransComponent[];
}

/**
 * Internal Trans component for Suspense mode.
 * Used by Babel-compiled output.
 */
export function __TransSuspense({
  __key,
  __chunk,
  __load,
  __a,
  __c,
}: TransSuspenseProps): ReactNode {
  const context = useContext(IdiomaContext);
  if (!context) {
    throw new Error(
      '[idioma] Trans must be used within an IdiomaProvider. ' +
        'Make sure to wrap your app with <IdiomaProvider>.',
    );
  }

  const { locale } = context;

  // use() suspends until promise resolves
  const translations = use(getTranslations(locale, __chunk, __load));
  const msg = translations[__key];

  if (msg === undefined) {
    return __key; // Fallback to key
  }

  // Use shared rendering logic (handles ICU functions, tags, and values)
  return renderMessage(msg, __a, __c);
}

/**
 * Props for key-only Trans in Suspense mode.
 */
export interface TransKeyOnlyModeProps<
  K extends string,
  MV extends Record<string, Record<string, unknown>>,
  MC extends Record<string, TransComponent[]>,
> {
  id: K;
  children?: never;
  context?: never;
  ns?: string;
  values?: K extends keyof MV ? MV[K] : Record<string, unknown>;
  components?: K extends keyof MC ? MC[K] : TransComponent[];
  // Suspense mode requires chunk/load from Babel transform
  __chunk?: string;
  __load?: Loader;
}

/**
 * Props for inline Trans in Suspense mode (dev only).
 */
export interface TransInlineModeProps {
  children: ReactNode;
  id?: string;
  context?: string;
  ns?: string;
}

/**
 * Creates a typed Trans component for Suspense mode.
 *
 * In development: renders children directly
 * In production: Babel transforms to __TransSuspense
 */
export function createTrans<
  TK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
  MC extends Record<string, TransComponent[]> = Record<
    string,
    TransComponent[]
  >,
>(_config: SuspenseConfig) {
  function Trans(props: TransInlineModeProps): ReactNode;
  function Trans<K extends TK>(
    props: TransKeyOnlyModeProps<K, MV, MC>,
  ): ReactNode;
  function Trans(
    props: TransInlineModeProps | TransKeyOnlyModeProps<TK, MV, MC>,
  ): ReactNode {
    // Inline mode: children present - render them directly
    // In production, Babel transforms this to __TransSuspense
    if ('children' in props && props.children !== undefined) {
      return props.children;
    }

    // Key-only mode in Suspense: requires __chunk and __load from Babel
    const { __chunk, __load, id, values, components } =
      props as TransKeyOnlyModeProps<TK, MV, MC>;

    if (__chunk && __load) {
      return (
        <__TransSuspense
          __key={id}
          __chunk={__chunk}
          __load={__load}
          __a={values}
          __c={components}
        />
      );
    }

    // Fallback: no loader available (shouldn't happen in production)
    throw new Error(
      '[idioma] Key-only Trans in Suspense mode requires Babel transform. ' +
        'Make sure the Babel plugin is configured correctly.',
    );
  }

  return Trans;
}

// ============ useT Hook ============

export type TFunction<
  K extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
> = <Key extends K>(
  key: Key,
  values?: Key extends keyof MV ? MV[Key] : Record<string, unknown>,
) => string;

/**
 * Internal useT for Suspense mode.
 * Requires chunk and loader from Babel transform.
 */
export function __useTSuspense(
  chunk: string,
  loader: Loader,
): (key: string, values?: Record<string, unknown>) => string {
  const context = useContext(IdiomaContext);
  if (!context) {
    throw new Error(
      '[idioma] useT must be used within an IdiomaProvider. ' +
        'Make sure to wrap your app with <IdiomaProvider>.',
    );
  }

  const { locale } = context;

  // use() suspends until promise resolves
  const translations = use(getTranslations(locale, chunk, loader));

  return (key: string, values?: Record<string, unknown>) => {
    const msg = translations[key];
    if (msg === undefined) {
      return key;
    }
    // Handle ICU-compiled functions
    if (typeof msg === 'function') {
      return msg(values || {}) as string;
    }
    if (values && Object.keys(values).length > 0) {
      return interpolateValues(msg, values);
    }
    return msg;
  };
}

/**
 * Creates a typed useT hook for Suspense mode.
 *
 * Note: In Suspense mode, useT is transformed by Babel to include
 * chunk and loader information.
 */
export function createUseT<
  K extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
>(_config: SuspenseConfig): () => TFunction<K, MV> {
  // Return a hook that throws when called
  // In production with proper Babel setup, this would be transformed
  return function useT(): TFunction<K, MV> {
    throw new Error(
      '[idioma] useT in Suspense mode requires Babel transform. ' +
        'Make sure the Babel plugin is configured correctly.',
    );
  };
}
