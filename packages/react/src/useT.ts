import { useCallback, useContext } from 'react';
import { IdiomaContext } from './context';
import { interpolateValues } from './interpolate';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageFunction = (args: any) => string;
type Translations = Record<string, Record<string, string | MessageFunction>>;

export interface UseTOptions {
  /** Optional namespace */
  ns?: string;
}

/**
 * Internal useT hook used by Babel-compiled output.
 * Not intended for direct use - import useT from the generated idioma/ folder instead.
 *
 * @example
 * // Compiled output:
 * const t = __useT(__$idioma)
 * const label = t("key")
 * const greeting = t("welcome", { name })
 */
export function __useT(
  translations: Translations,
  _options?: UseTOptions,
): (key: string, args?: Record<string, unknown>) => string {
  const context = useContext(IdiomaContext);
  if (!context) {
    throw new Error(
      '[idioma] useT must be used within an IdiomaProvider. ' +
        'Make sure to wrap your app with <IdiomaProvider>.',
    );
  }

  const { locale } = context;

  // Return a translator function that closes over locale
  return useCallback(
    (key: string, args?: Record<string, unknown>): string => {
      const localeMessages = translations[key];
      if (!localeMessages) {
        // Key not found - return key as fallback
        return key;
      }

      const msg = localeMessages[locale];
      if (msg === undefined) {
        // Locale not found - try to find any available message
        const fallback = Object.values(localeMessages)[0];
        if (fallback === undefined) {
          return key;
        }
        if (typeof fallback === 'function') {
          return fallback(args || {});
        }
        return args ? interpolateValues(fallback, args) : fallback;
      }

      if (typeof msg === 'function') {
        return msg(args || {});
      }

      return args ? interpolateValues(msg, args) : msg;
    },
    [translations, locale],
  );
}
