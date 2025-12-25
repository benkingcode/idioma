import { useCallback, useContext } from 'react';
import { IdiomaContext } from './context';
import { interpolateValues } from './interpolate';
import { generateKey } from './server/generateKey';

type MessageFunction = (args: Record<string, unknown>) => string;
type Translations = Record<string, Record<string, string | MessageFunction>>;

/**
 * Key-only mode arguments: t({ id: "welcome", values: { name } })
 */
export interface KeyOnlyArgs {
  id: string;
  values?: Record<string, unknown>;
}

/**
 * Source text mode options: t("Submit", { context: "button", name: "Ben" })
 */
export interface SourceTextOptions extends Record<string, unknown> {
  context?: string;
}

/**
 * Type for the t function returned by useT.
 * Supports both source text mode and key-only mode.
 */
export type TFunction = {
  (args: KeyOnlyArgs): string;
  (source: string, options?: SourceTextOptions): string;
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
 * t('Hello {name}', { name: 'Ben' })  // with values
 * t({ id: 'welcome' })  // key-only mode
 * t({ id: 'greeting', values: { name: 'Ben' } })  // key-only with values
 * t('Submit', { context: 'button' })  // with context
 */
export function createUseT(translations: Translations) {
  return function useT(): TFunction {
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
        sourceOrArgs: string | KeyOnlyArgs,
        options?: SourceTextOptions,
      ): string => {
        // Key-only mode: t({ id: 'welcome', values: { name } })
        if (typeof sourceOrArgs === 'object') {
          const { id, values } = sourceOrArgs;
          const localeMessages = translations[id];
          if (!localeMessages) return id;

          const msg =
            localeMessages[locale] ?? Object.values(localeMessages)[0];
          if (msg === undefined) return id;
          if (typeof msg === 'function') return msg(values || {});
          return values ? interpolateValues(msg, values) : msg;
        }

        // Source text mode: t('Hello {name}', { name: 'Ben', context: 'button' })
        const source = sourceOrArgs;
        const { context, ...values } = options || {};
        const key = generateKey(source, context);
        const localeMessages = translations[key];

        if (!localeMessages) {
          // Fallback: interpolate source text if values provided
          return Object.keys(values).length > 0
            ? interpolateValues(source, values)
            : source;
        }

        const msg = localeMessages[locale] ?? Object.values(localeMessages)[0];
        if (msg === undefined) {
          return Object.keys(values).length > 0
            ? interpolateValues(source, values)
            : source;
        }

        if (typeof msg === 'function') {
          return msg(values || {});
        }

        return Object.keys(values).length > 0
          ? interpolateValues(msg, values)
          : msg;
      },
      [locale],
    ) as TFunction;
  };
}
