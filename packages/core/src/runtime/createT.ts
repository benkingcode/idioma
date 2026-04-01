import { generateKey } from '../keys/generator.js';

/** Translations object shape from compiler */
type TranslationsMap = Record<string, Record<string, string>>;

// =============================================================================
// Helper types for typed overloads
// =============================================================================

/** Keys in MessageValues that have at least one required value.
 *  TK filters to specific TranslationKey union, excluding index signature keys. */
type KeysWithValues<
  MV extends Record<string, Record<string, unknown>>,
  TK extends string = Extract<keyof MV, string>,
> = {
  [K in TK & keyof MV]: MV[K] extends Record<string, never> ? never : K;
}[TK & keyof MV];

/** Keys in MessageValues that have no required values.
 *  TK filters to specific TranslationKey union, excluding index signature keys. */
type KeysWithoutValues<
  MV extends Record<string, Record<string, unknown>>,
  TK extends string = Extract<keyof MV, string>,
> = {
  [K in TK & keyof MV]: MV[K] extends Record<string, never> ? K : never;
}[TK & keyof MV];

/**
 * Type for the t function returned by createT.
 * Supports both source text mode and key-only mode.
 */
export type PlainTFunction<
  TK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
> = {
  // === Key-only mode ===

  // Keys that require values
  <K extends KeysWithValues<MV, TK> & string>(args: {
    id: K;
    values: MV[K];
    source?: string;
    context?: string;
    ns?: string;
  }): string;

  // Keys that don't require values
  <K extends KeysWithoutValues<MV, TK> & string>(args: {
    id: K;
    values?: never;
    source?: string;
    context?: string;
    ns?: string;
  }): string;

  // === Source text mode ===

  (source: string): string;
  (source: string, values: Record<string, unknown>): string;
  (
    source: string,
    inlinedOrValues: Record<string, unknown>,
    values: Record<string, unknown>,
  ): string;
};

/**
 * Interpolate placeholder values in a message string.
 * Replaces {key} with the corresponding value from args.
 */
function interpolateValues(
  message: string,
  args: Record<string, unknown>,
): string {
  return message.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const value = args[key];
    if (value === undefined) return match;
    return String(value);
  });
}

/**
 * Check if a value is an inlined translations object (from Babel).
 * Inlined translations have the shape: { __m: { locale: translation } }
 */
function isInlinedTranslations(
  value: unknown,
): value is { __m: Record<string, string> } {
  if (typeof value !== 'object' || value === null) return false;
  return '__m' in value;
}

/**
 * Factory to create a synchronous translation function for use outside React components.
 *
 * This function supports three translation modes:
 * 1. Babel-inlined: t('source', { key: { en: '...', es: '...' } }) - optimal, tree-shaken
 * 2. Runtime lookup: t('dynamic string') with translations object - for dynamic strings
 * 3. Fallback: Returns source text when no translation found
 *
 * @param locale - The locale to use for translations
 * @param translations - Optional translations object for runtime lookup of dynamic strings
 * @returns A synchronous translation function
 *
 * @internal Used by generated idioma/plain.ts — import `createT` from there instead.
 */
export function _createTFactory<
  TKey extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
>(locale: string, translations?: TranslationsMap): PlainTFunction<TKey, MV> {
  return ((
    source:
      | string
      | { id: string; source?: string; values?: Record<string, unknown> },
    inlinedOrValues?: Record<string, unknown>,
    values?: Record<string, unknown>,
  ): string => {
    // Case 0: Object form fallback (Babel didn't transform)
    // Shape: { id: 'key', source: 'Hello', values: { name } }
    if (typeof source === 'object' && source !== null) {
      const fallbackText = source.source || source.id;
      if (source.values && Object.keys(source.values).length > 0) {
        return interpolateValues(fallbackText, source.values);
      }
      return fallbackText;
    }

    // Case 1: Inlined translations from Babel (highest priority)
    // Shape: { __m: { en: 'Hello', es: 'Hola' } }
    if (inlinedOrValues && isInlinedTranslations(inlinedOrValues)) {
      const localeMessages = inlinedOrValues.__m;
      if (!localeMessages) return source;

      // Try to get message for requested locale, fall back to first available
      const msg = localeMessages[locale] ?? Object.values(localeMessages)[0];
      if (msg === undefined) return source;

      // Apply value interpolation if provided
      if (values && Object.keys(values).length > 0) {
        return interpolateValues(msg, values);
      }

      return msg;
    }

    // Case 2: Runtime lookup for dynamic strings
    // Hash the source to find the key, then look up in translations
    if (translations) {
      const key = generateKey(source);
      const localeMessages = translations[key];
      if (localeMessages) {
        const msg = localeMessages[locale] ?? Object.values(localeMessages)[0];
        if (msg !== undefined) {
          // Apply value interpolation if second arg is values (not inlined translations)
          if (inlinedOrValues && Object.keys(inlinedOrValues).length > 0) {
            return interpolateValues(msg, inlinedOrValues);
          }
          return msg;
        }
      }
    }

    // Case 3: Just values for interpolation (no translation found)
    // Shape: { name: 'Ben', count: 5 }
    if (inlinedOrValues && Object.keys(inlinedOrValues).length > 0) {
      return interpolateValues(source, inlinedOrValues);
    }

    // Case 4: No translations, no values - return source as-is
    return source as string;
  }) as PlainTFunction<TKey, MV>;
}
