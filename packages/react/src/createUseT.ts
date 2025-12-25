import { useCallback, useContext } from 'react';
import { IdiomaContext } from './context';
import { interpolateValues } from './interpolate';
import { generateKey } from './server/generateKey';

type MessageFunction = (args: Record<string, unknown>) => string;
type Translations = Record<string, Record<string, string | MessageFunction>>;

// =============================================================================
// Helper Types for Strict Typing
// =============================================================================

// --- Key-only mode helpers ---

/** Keys in MessageValues that have at least one required value */
export type KeysWithValues<MV extends Record<string, Record<string, unknown>>> =
  {
    [K in keyof MV]: MV[K] extends Record<string, never> ? never : K;
  }[keyof MV];

/** Keys in MessageValues that have no required values */
export type KeysWithoutValues<
  MV extends Record<string, Record<string, unknown>>,
> = {
  [K in keyof MV]: MV[K] extends Record<string, never> ? K : never;
}[keyof MV];

// --- Source text mode helpers ---

/**
 * Recursively extract placeholder names from a template string.
 * "Hello {name}, you have {count} items" → "name" | "count"
 */
export type ExtractPlaceholders<S extends string> =
  S extends `${infer _}{${infer Key}}${infer Rest}`
    ? Key | ExtractPlaceholders<Rest>
    : never;

/**
 * Build the required values object from extracted placeholders.
 * "Hello {name}" → { name: string | number }
 * "No placeholders" → undefined
 */
export type PlaceholderValues<S extends string> =
  ExtractPlaceholders<S> extends never
    ? undefined
    : { [K in ExtractPlaceholders<S>]: string | number };

/** Check if a string has any placeholders */
export type HasPlaceholders<S extends string> =
  ExtractPlaceholders<S> extends never ? false : true;

/**
 * Source text mode options: t("Submit", undefined, { context: "button", ns: "common" })
 */
export interface SourceTextOptions {
  /** Translator context (changes key hash) */
  context?: string;
  /** Namespace for scoped lookups (placeholder for future) */
  ns?: string;
}

/**
 * Type for the t function returned by useT.
 * Supports both source text mode and key-only mode with full type safety.
 *
 * @template SK - StringOnlyKey union (valid translation keys)
 * @template MV - MessageValues interface (maps keys to required values)
 */
export type TFunction<
  SK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
> = {
  // === Key-only mode ===

  // Keys that require values
  <K extends SK & string>(
    args: K extends KeysWithValues<MV>
      ? { id: K; values: MV[K]; context?: string; ns?: string }
      : K extends KeysWithoutValues<MV>
        ? { id: K; values?: never; context?: string; ns?: string }
        : {
            id: K;
            values?: Record<string, unknown>;
            context?: string;
            ns?: string;
          },
  ): string;

  // === Source text mode ===

  // Source text WITH placeholders - values required
  <S extends string>(
    source: HasPlaceholders<S> extends true ? S : never,
    values: PlaceholderValues<S>,
  ): string;

  // Source text WITHOUT placeholders - no values
  <S extends string>(
    source: HasPlaceholders<S> extends false ? S : never,
  ): string;

  // Source text with options (3rd arg)
  <S extends string>(
    source: S,
    values: PlaceholderValues<S>,
    options: SourceTextOptions,
  ): string;
};

/**
 * Creates a typed useT hook for imperative translations.
 *
 * Supports both source text mode and key-only mode:
 * - Source text: t('Hello world!') - hashes and looks up
 * - Key-only: t({ id: 'welcome' }) - direct key lookup
 *
 * Only works with messages that don't require component interpolation,
 * since it returns a string. For messages with <0>...</0> tags, use <Trans>.
 *
 * @example
 * // In generated idioma/index.ts:
 * export const useT = createUseT(translations)
 *
 * // Usage:
 * const t = useT()
 * t('Hello world!')  // source text mode
 * t('Hello {name}', { name: 'Ben' })  // with values (2nd arg)
 * t('Submit', undefined, { context: 'button' })  // with options (3rd arg)
 * t('Hello {name}', { name: 'Ben' }, { context: 'greeting' })  // both
 * t({ id: 'welcome' })  // key-only mode
 * t({ id: 'greeting', values: { name: 'Ben' }, ns: 'common' })  // with ns
 */
// Internal runtime type for key-only args (untyped at runtime)
interface KeyOnlyArgsRuntime {
  id: string;
  values?: Record<string, unknown>;
  context?: string;
  ns?: string;
}

export function createUseT<
  SK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
>(translations: Translations): () => TFunction<SK, MV> {
  return function useT(): TFunction<SK, MV> {
    const ctx = useContext(IdiomaContext);
    if (!ctx) {
      throw new Error(
        '[idioma] useT must be used within an IdiomaProvider. ' +
          'Make sure to wrap your app with <IdiomaProvider>.',
      );
    }

    const { locale } = ctx;

    return useCallback(
      (
        sourceOrArgs: string | KeyOnlyArgsRuntime,
        values?: Record<string, unknown>,
        options?: SourceTextOptions,
      ): string => {
        // Helper to get locale messages from the right place (namespace or top-level)
        const getLocaleMessages = (
          key: string,
          ns?: string,
        ): Record<string, string | MessageFunction> | undefined => {
          if (ns) {
            // Look in __ns.{namespace}.{key}
            const nsTranslations = (
              translations as unknown as { __ns?: Record<string, Translations> }
            ).__ns;
            return nsTranslations?.[ns]?.[key];
          }
          // Look at top level
          return translations[key];
        };

        // Key-only mode: t({ id: 'welcome', values: { name }, ns: 'common' })
        if (typeof sourceOrArgs === 'object') {
          const { id, values: keyValues, ns } = sourceOrArgs;
          const localeMessages = getLocaleMessages(id, ns);
          if (!localeMessages) return id;

          const msg =
            localeMessages[locale] ?? Object.values(localeMessages)[0];
          if (msg === undefined) return id;
          if (typeof msg === 'function') return msg(keyValues || {});
          return keyValues ? interpolateValues(msg, keyValues) : msg;
        }

        // Source text mode: t('Hello {name}', { name: 'Ben' }, { context: 'button', ns: 'auth' })
        const source = sourceOrArgs;
        const { context, ns } = options || {};
        const key = generateKey(source, context, ns);
        const localeMessages = getLocaleMessages(key, ns);

        if (!localeMessages) {
          // Fallback: interpolate source text if values provided
          return values && Object.keys(values).length > 0
            ? interpolateValues(source, values)
            : source;
        }

        const msg = localeMessages[locale] ?? Object.values(localeMessages)[0];
        if (msg === undefined) {
          return values && Object.keys(values).length > 0
            ? interpolateValues(source, values)
            : source;
        }

        if (typeof msg === 'function') {
          return msg(values || {});
        }

        return values && Object.keys(values).length > 0
          ? interpolateValues(msg, values)
          : msg;
      },
      [locale],
    ) as TFunction<SK, MV>;
  };
}
