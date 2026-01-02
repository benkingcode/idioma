'use client';

/**
 * Suspense-based runtime for @idiomi/react.
 *
 * This module provides React components that use dynamic imports
 * and the React 19 `use()` hook for Suspense-based lazy loading.
 *
 * Requires React 19+.
 */
import { use, useContext, version, type ReactNode } from 'react';
// Import IdiomiContext for internal use (useContext calls)
import { IdiomiContext } from '../context';
import {
  interpolateValues,
  renderMessage,
  type TransComponent,
} from '../interpolate';
// Import shared Trans types
import type {
  TransInlineModeProps,
  TransKeyOnlyModeProps,
} from '../Trans.types';
// ============ useT Hook ============

// Import shared types from useT.types.ts (same types used by inlined mode)
import type { BaseIdiomiConfig, TFunction } from '../useT.types';

// ============ React Version Check ============

const majorVersion = parseInt(version.split('.')[0]!, 10);

if (majorVersion < 19) {
  throw new Error(
    `[idiomi] useSuspense mode requires React 19+. ` +
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
// Re-export shared context from main module to ensure single context instance
// This is critical: @idiomi/next's Link uses IdiomiContext from @idiomi/react,
// so we must use the same context here for IdiomiProvider to work with Link
export {
  createIdiomiProvider,
  createUseLocale,
  IdiomiContext,
  type IdiomiContextValue,
  type IdiomiProviderProps,
} from '../context';

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
  /** Component names for named tag matching (parallel to __c array) */
  __cn?: string[];
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
  __cn,
}: TransSuspenseProps): ReactNode {
  const context = useContext(IdiomiContext);
  if (!context) {
    throw new Error(
      '[idiomi] Trans must be used within an IdiomiProvider. ' +
        'Make sure to wrap your app with <IdiomiProvider>.',
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
  return renderMessage(msg, __a, __c, __cn);
}

/**
 * Suspense-specific extension of TransKeyOnlyModeProps.
 * Adds __chunk and __load props required by Babel transform.
 */
type TransKeyOnlyModePropsSuspense<
  K extends string,
  MV extends Record<string, Record<string, unknown>>,
  MC extends Record<string, TransComponent[]>,
> = TransKeyOnlyModeProps<K, MV, MC> & {
  __chunk?: string;
  __load?: Loader;
};

/**
 * Creates a typed Trans component for Suspense mode.
 *
 * In development: renders children directly
 * In production: Babel transforms to __TransSuspense
 */
export function createTransSuspense<
  C extends BaseIdiomiConfig = BaseIdiomiConfig,
>(_config: SuspenseConfig) {
  type TK = C['TranslationKey'];
  type MV = C['MessageValues'];
  type MC = C['MessageComponents'];

  // Type alias to ensure MC satisfies TransComponent[] constraint
  type MCTyped = MC & Record<string, TransComponent[]>;

  function Trans(props: TransInlineModeProps): ReactNode;
  function Trans<K extends TK>(
    props: TransKeyOnlyModePropsSuspense<K & string, MV, MCTyped>,
  ): ReactNode;
  function Trans(
    props:
      | TransInlineModeProps
      | TransKeyOnlyModePropsSuspense<TK & string, MV, MCTyped>,
  ): ReactNode {
    // Inline mode: children present - render them directly
    // In production, Babel transforms this to __TransSuspense
    if ('children' in props && props.children !== undefined) {
      return props.children;
    }

    // Key-only mode in Suspense: requires __chunk and __load from Babel
    const { __chunk, __load, id, values, components } =
      props as TransKeyOnlyModePropsSuspense<TK & string, MV, MCTyped>;

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
      '[idiomi] Key-only Trans in Suspense mode requires Babel transform. ' +
        'Make sure the Babel plugin is configured correctly.',
    );
  }

  return Trans;
}

export type { TFunction };

/**
 * Internal useT for Suspense mode.
 * Requires chunk and loader from Babel transform.
 */
export function __useTSuspense(
  _chunk: string,
  _loader: Loader,
): (key: string, values?: Record<string, unknown>) => string {
  const context = useContext(IdiomiContext);
  if (!context) {
    throw new Error(
      '[idiomi] useT must be used within an IdiomiProvider. ' +
        'Make sure to wrap your app with <IdiomiProvider>.',
    );
  }

  const { locale: _locale } = context;

  // Note: In properly transformed code, Babel provides the key directly.
  // This function is a fallback when Babel didn't transform.

  return (source: string, values?: Record<string, unknown>) => {
    // In Suspense mode, Babel should transform useT calls to include the key
    // If we get here with source text, Babel didn't transform - graceful fallback
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `Idiomi: Missing translations for "${source}". ` +
          'Ensure the Babel plugin is configured.',
      );
    }
    // Fallback: return source with values interpolated if possible
    if (values && Object.keys(values).length > 0) {
      return interpolateValues(source, values);
    }
    return source;
  };
}

/**
 * Creates a typed useT hook for Suspense mode.
 *
 * Note: In Suspense mode, useT is transformed by Babel to include
 * chunk and loader information.
 */
export function createUseTSuspense<
  C extends BaseIdiomiConfig = BaseIdiomiConfig,
>(_config: SuspenseConfig): () => TFunction<C> {
  // Return a hook that throws when called
  // In production with proper Babel setup, this would be transformed
  return function useT(): TFunction<C> {
    throw new Error(
      '[idiomi] useT in Suspense mode requires Babel transform. ' +
        'Make sure the Babel plugin is configured correctly.',
    );
  };
}
