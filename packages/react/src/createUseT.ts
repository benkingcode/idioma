import { useCallback, useContext } from 'react';
import { IdiomaContext } from './context';
import { interpolateValues } from './interpolate';

type MessageFunction = (args: Record<string, unknown>) => string;
type Translations = Record<string, Record<string, string | MessageFunction>>;

/**
 * Type for the t function returned by useT.
 * Only accepts StringOnlyKey (messages without component tags).
 */
export type TFunction<
  SK extends string,
  MV extends Record<string, Record<string, unknown>>,
> = <K extends SK>(
  key: K,
  ...args: K extends keyof MV
    ? keyof MV[K] extends never
      ? []
      : [values: MV[K]]
    : [values?: Record<string, unknown>]
) => string;

/**
 * Creates a typed useT hook for imperative translations.
 *
 * Only works with messages that don't require component interpolation,
 * since it returns a string. For messages with <0>...</0> tags, use <Trans>.
 *
 * @example
 * // In generated idioma/index.ts:
 * export const useT = createUseT<StringOnlyKey, MessageValues>(translations)
 *
 * // Usage:
 * const t = useT()
 * t('checkout.heading')
 * t('welcome', { name: 'Ben' })
 */
export function createUseT<
  SK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
>(translations: Translations) {
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
      (key: string, values?: Record<string, unknown>): string => {
        const localeMessages = translations[key];
        if (!localeMessages) {
          return key;
        }

        const msg = localeMessages[locale];
        if (msg === undefined) {
          const fallback = Object.values(localeMessages)[0];
          if (fallback === undefined) {
            return key;
          }
          if (typeof fallback === 'function') {
            return fallback(values || {});
          }
          return values ? interpolateValues(fallback, values) : fallback;
        }

        if (typeof msg === 'function') {
          return msg(values || {});
        }

        return values ? interpolateValues(msg, values) : msg;
      },
      [locale],
    ) as TFunction<SK, MV>;
  };
}
