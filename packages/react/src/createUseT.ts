'use client';

import { useCallback, useContext } from 'react';
import { IdiomiContext } from './context';
import { interpolateValues } from './interpolate';
import type {
  BaseIdiomiConfig,
  SourceTextOptions,
  TFunction,
} from './useT.types';

type MessageFunction = (args: Record<string, unknown>) => string;

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
 * // In generated idiomi/index.ts:
 * export const useT = createUseT<IdiomiTypes>()
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
  C extends BaseIdiomiConfig = BaseIdiomiConfig,
>(): () => TFunction<C> {
  /**
   * useT hook for imperative translations.
   *
   * Babel transforms t() calls to include inlined translations.
   * This hook handles the transformed calls and provides fallback behavior.
   */
  return function useT(): TFunction<C> {
    const ctx = useContext(IdiomiContext);
    if (!ctx) {
      throw new Error(
        '[idiomi] useT must be used within an IdiomiProvider. ' +
          'Make sure to wrap your app with <IdiomiProvider>.',
      );
    }

    const { locale } = ctx;

    return useCallback(
      (
        sourceOrArgs: string | KeyOnlyArgsRuntime,
        values?: Record<string, unknown>,
        options?: SourceTextOptions,
      ): string => {
        // Key-only mode: t({ id: 'welcome', values: { name }, ns: 'common' })
        // Babel should transform this, but if not, return the id as fallback
        if (typeof sourceOrArgs === 'object') {
          const { id } = sourceOrArgs;
          console.warn(
            `[idiomi] t({ id: "${id}" }) was not transformed by Babel. ` +
              'Make sure @idiomi/core Babel plugin is configured.',
          );
          return id;
        }

        // Source text mode: t('Hello {name}', { name: 'Ben' }, { context: 'button' })
        // OR after Babel transformation: t('Hello {name}', { key: { en: '...', es: '...' } }, { name: 'Ben' })
        const source = sourceOrArgs;

        // Detect if Babel has inlined translations in arg 2
        // Babel transforms: t('src', { key: { en: '...', es: '...' } }, { actualValues })
        // The inlined object has ONE key (the message key) whose value has locale keys
        let actualValues = values;
        let localeMessages:
          | Record<string, string | MessageFunction>
          | undefined;

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
          localeMessages = firstValue as Record<
            string,
            string | MessageFunction
          >;
          actualValues = options as unknown as Record<string, unknown>;
        }

        if (!localeMessages) {
          // Not transformed by Babel - fallback to source text
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
      [locale],
    ) as TFunction<C>;
  };
}
