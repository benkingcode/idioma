import type {
  HasPlaceholders,
  KeysWithoutValues,
  KeysWithValues,
  PlaceholderValues,
} from '../createUseT';
import { interpolateValues } from '../interpolate';
import { generateKey } from './generateKey';

type MessageFunction = (args: Record<string, unknown>) => string;
type Translations = Record<string, Record<string, string | MessageFunction>>;

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
 * Server-side translation function type with full type safety.
 * Supports both source text and key-only modes.
 *
 * @template SK - StringOnlyKey union (valid translation keys)
 * @template MV - MessageValues interface (maps keys to required values)
 */
export type ServerTFunction<
  SK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
> = {
  // === Key-only mode ===

  // Keys that require values or not, determined by MV
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
  ): Promise<string>;

  // === Source text mode ===

  // Source text WITH placeholders - values required
  <S extends string>(
    source: HasPlaceholders<S> extends true ? S : never,
    values: PlaceholderValues<S>,
  ): Promise<string>;

  // Source text WITHOUT placeholders - no values
  <S extends string>(
    source: HasPlaceholders<S> extends false ? S : never,
  ): Promise<string>;

  // Source text with options (3rd arg)
  <S extends string>(
    source: S,
    values: PlaceholderValues<S>,
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
// Internal runtime type for key-only args (untyped at runtime)
interface KeyOnlyArgsRuntime {
  id: string;
  values?: Record<string, unknown>;
  context?: string;
  ns?: string;
}

export function createServerT<
  SK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
>(locale: string, translations: Translations): ServerTFunction<SK, MV> {
  return (async (
    sourceOrArgs: string | KeyOnlyArgsRuntime,
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
  }) as ServerTFunction<SK, MV>;
}
