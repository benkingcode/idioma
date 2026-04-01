import { generateKey } from '../keys/generator.js';

/** Translations object shape from compiler */
type TranslationsMap = Record<string, Record<string, string>>;

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
  TValues extends Record<string, unknown> = Record<string, unknown>,
>(
  locale: string,
  translations?: TranslationsMap,
): (
  source: TKey,
  inlinedOrValues?: Record<string, unknown>,
  values?: TValues,
) => string {
  return (
    source: TKey,
    inlinedOrValues?: Record<string, unknown>,
    values?: TValues,
  ): string => {
    // Case 0: Object form fallback (Babel didn't transform)
    // Shape: { id: 'key', source: 'Hello', values: { name } }
    if (typeof source === 'object' && source !== null) {
      const obj = source as unknown as {
        id: string;
        source?: string;
        values?: Record<string, unknown>;
      };
      const fallbackText = obj.source || obj.id;
      if (obj.values && Object.keys(obj.values).length > 0) {
        return interpolateValues(fallbackText, obj.values);
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
    return source;
  };
}
