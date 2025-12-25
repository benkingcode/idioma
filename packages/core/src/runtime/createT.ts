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
 * Inlined translations have the shape: { key: { locale: translation } }
 * Regular values have the shape: { name: "Ben", count: 5 }
 */
function isInlinedTranslations(
  value: unknown,
): value is Record<string, Record<string, string>> {
  if (typeof value !== 'object' || value === null) return false;
  const firstValue = Object.values(value)[0];
  return typeof firstValue === 'object' && firstValue !== null;
}

/**
 * Creates a synchronous translation function for use outside React components.
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
 * @example
 * // Static strings (Babel inlines translations)
 * const t = createT('es');
 * t('Hello world');  // → 'Hola mundo'
 *
 * // Dynamic strings (runtime lookup)
 * const t = createT('es', translations);
 * const msg = getErrorMessage();
 * t(msg);  // → looks up by hashing msg
 *
 * // With placeholder values
 * t('Hello {name}', { name: 'Ben' });  // → 'Hola Ben'
 */
export function createT(locale: string, translations?: TranslationsMap) {
  return (
    source: string,
    inlinedOrValues?: Record<string, unknown>,
    values?: Record<string, unknown>,
  ): string => {
    // Case 1: Inlined translations from Babel (highest priority)
    // Shape: { key: { en: 'Hello', es: 'Hola' } }
    if (inlinedOrValues && isInlinedTranslations(inlinedOrValues)) {
      const inlined = inlinedOrValues;
      const key = Object.keys(inlined)[0];
      if (!key) return source;

      const localeMessages = inlined[key];
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
