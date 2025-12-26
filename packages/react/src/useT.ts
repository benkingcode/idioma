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
  /** Translator comment (extracted to PO #. comment for translators) */
  comment?: string;
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
      // OR after Babel transformation: t('Hello {name}', { en: '...', es: '...' }, { name: 'Ben' })
      const source = sourceOrArgs;

      // Detect if Babel has inlined translations in arg 2
      // Babel transforms: t('src', { key: { en: '...', es: '...' } }, { actualValues })
      // The inlined object has ONE key (the message key) whose value has locale keys
      let actualValues = values;
      let localeMessages: Record<string, string | MessageFunction> | undefined;

      const valuesKeys = values ? Object.keys(values) : [];
      const firstKey = valuesKeys[0];
      const firstValue =
        firstKey && values
          ? (values as Record<string, unknown>)[firstKey]
          : undefined;

      // Check if this looks like Babel-inlined translations:
      // - Has exactly one key (the message key)
      // - That key's value is an object with locale as a property
      if (
        valuesKeys.length === 1 &&
        firstValue &&
        typeof firstValue === 'object' &&
        typeof (firstValue as Record<string, unknown>)[locale] !== 'undefined'
      ) {
        // Babel transformed: arg 2 is { messageKey: { en: '...', es: '...' } }
        localeMessages = firstValue as Record<string, string | MessageFunction>;
        actualValues = options as unknown as Record<string, unknown>;
      } else {
        // Normal mode: arg 2 is values, arg 3 is options
        const { context: ctx } = options || {};
        const key = generateKey(source, ctx);
        localeMessages = translations[key];
      }

      if (!localeMessages) {
        // Fallback: interpolate source text if values provided
        return actualValues && Object.keys(actualValues).length > 0
          ? interpolateValues(source, actualValues)
          : source;
      }

      const msg = localeMessages[locale] ?? Object.values(localeMessages)[0];
      if (msg === undefined) {
        return actualValues && Object.keys(actualValues).length > 0
          ? interpolateValues(source, actualValues)
          : source;
      }

      if (typeof msg === 'function') {
        return msg(actualValues || {});
      }

      return actualValues && Object.keys(actualValues).length > 0
        ? interpolateValues(msg, actualValues)
        : msg;
    },
    [translations, locale],
  ) as UseTFunction;
}
