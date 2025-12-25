import { useCallback, useContext } from 'react';
import { IdiomaContext } from './context';
import { interpolateValues } from './interpolate';
import { generateKey } from './server/generateKey';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageFunction = (args: any) => string;
type Translations = Record<string, Record<string, string | MessageFunction>>;

export interface UseTOptions {
  /** Optional namespace */
  ns?: string;
}

/**
 * Key-only mode arguments: t({ id: "welcome", values: { name }, context: "modal", ns: "common" })
 */
export interface KeyOnlyArgs {
  id: string;
  values?: Record<string, unknown>;
  /** Translator context (saved in PO for human reference, not used in key lookup) */
  context?: string;
  /** Namespace for scoped lookups (placeholder for future) */
  ns?: string;
}

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
 * Type for the t function returned by __useT.
 * Supports both source text mode and key-only mode.
 */
export type UseTFunction = {
  (args: KeyOnlyArgs): string;
  (source: string): string;
  (source: string, values: Record<string, unknown>): string;
  (
    source: string,
    values: Record<string, unknown> | undefined,
    options: SourceTextOptions,
  ): string;
};

/**
 * Internal useT hook used by Babel-compiled output.
 * Not intended for direct use - import useT from the generated idioma/ folder instead.
 *
 * Supports both source text mode and key-only mode:
 * - Source text: t('Hello world!') - hashes and looks up
 * - Key-only: t({ id: 'welcome' }) - direct key lookup
 *
 * @example
 * // Compiled output:
 * const t = __useT(__$idioma)
 * const label = t('Hello world!')
 * const greeting = t('Hello {name}', { name })
 * t('Submit', undefined, { context: 'button' })  // with options (3rd arg)
 * t({ id: 'key', ns: 'common' })  // key-only with namespace
 */
export function __useT(
  translations: Translations,
  _options?: UseTOptions,
): UseTFunction {
  const context = useContext(IdiomaContext);
  if (!context) {
    throw new Error(
      '[idioma] useT must be used within an IdiomaProvider. ' +
        'Make sure to wrap your app with <IdiomaProvider>.',
    );
  }

  const { locale } = context;

  return useCallback(
    (
      sourceOrArgs: string | KeyOnlyArgs,
      values?: Record<string, unknown>,
      options?: SourceTextOptions,
    ): string => {
      // Key-only mode: t({ id: 'welcome', values: { name }, ns: 'common' })
      if (typeof sourceOrArgs === 'object') {
        const { id, values: keyValues } = sourceOrArgs;
        const localeMessages = translations[id];
        if (!localeMessages) return id;

        const msg = localeMessages[locale] ?? Object.values(localeMessages)[0];
        if (msg === undefined) return id;
        if (typeof msg === 'function') return msg(keyValues || {});
        return keyValues ? interpolateValues(msg, keyValues) : msg;
      }

      // Source text mode: t('Hello {name}', { name: 'Ben' }, { context: 'button' })
      const source = sourceOrArgs;
      const { context: ctx } = options || {};
      const key = generateKey(source, ctx);
      const localeMessages = translations[key];

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
    [translations, locale],
  ) as UseTFunction;
}
