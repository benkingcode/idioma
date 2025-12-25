import { interpolateValues } from '../interpolate';
import { generateKey } from './generateKey';

type MessageFunction = (args: Record<string, unknown>) => string;
type Translations = Record<string, Record<string, string | MessageFunction>>;

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
 * Server-side translation function type.
 * Supports both source text and key-only modes.
 */
export type ServerTFunction = {
  (args: KeyOnlyArgs): Promise<string>;
  (source: string): Promise<string>;
  (source: string, values: Record<string, unknown>): Promise<string>;
  (
    source: string,
    values: Record<string, unknown> | undefined,
    options: SourceTextOptions,
  ): Promise<string>;
};

/**
 * Creates a server-side translation function for React Server Components.
 *
 * @param locale - The locale to use for translations
 * @param translations - The compiled translations object
 * @returns An async translation function
 *
 * @example
 * // Source text mode
 * const t = createServerT('es', translations);
 * await t('Hello world!');  // 'Hola mundo!'
 * await t('Hello {name}', { name: 'Ben' });  // 'Hola Ben'
 *
 * // With context (3rd arg)
 * await t('Submit', undefined, { context: 'button' });  // 'Enviar'
 * await t('Hello {name}', { name: 'Ben' }, { context: 'greeting' });  // both
 *
 * // Key-only mode
 * await t({ id: 'welcome' });  // 'Bienvenido!'
 * await t({ id: 'greeting', values: { name: 'Ben' }, ns: 'common' });  // with ns
 */
export function createServerT(
  locale: string,
  translations: Translations,
): ServerTFunction {
  return async (
    sourceOrArgs: string | KeyOnlyArgs,
    values?: Record<string, unknown>,
    options?: SourceTextOptions,
  ): Promise<string> => {
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
    const { context } = options || {};
    const key = generateKey(source, context);
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
  };
}
