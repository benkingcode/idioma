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
 * This function is designed to work with Babel inlining. In production:
 * - Babel transforms t('source') to t('source', { key: { en: '...', es: '...' } })
 * - The runtime reads from the inlined translations object
 *
 * In development or for dynamic strings:
 * - Returns the source text (optionally with placeholder interpolation)
 *
 * @param locale - The locale to use for translations
 * @returns A synchronous translation function
 *
 * @example
 * const t = createT('es');
 *
 * // With Babel inlining (production)
 * t('Hello world');  // → 'Hola mundo'
 *
 * // With placeholder values
 * t('Hello {name}', { name: 'Ben' });  // → 'Hola Ben'
 */
export function createT(locale: string) {
  return (
    source: string,
    inlinedOrValues?: Record<string, unknown>,
    values?: Record<string, unknown>,
  ): string => {
    // Case 1: Inlined translations from Babel
    // Shape: { key: { en: 'Hello', es: 'Hola' } }
    if (inlinedOrValues && isInlinedTranslations(inlinedOrValues)) {
      const translations = inlinedOrValues;
      const key = Object.keys(translations)[0];
      if (!key) return source;

      const localeMessages = translations[key];
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

    // Case 2: Just values for interpolation (no Babel inlining)
    // Shape: { name: 'Ben', count: 5 }
    if (inlinedOrValues && Object.keys(inlinedOrValues).length > 0) {
      return interpolateValues(source, inlinedOrValues);
    }

    // Case 3: No translations, no values - return source as-is
    return source;
  };
}
