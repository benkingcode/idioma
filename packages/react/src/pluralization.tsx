// Note: No React imports needed - plural() is a pure function

export interface PluralForms {
  /** Form for zero (optional, falls back to other) */
  zero?: string;
  /** Form for one */
  one?: string;
  /** Form for two (used in some languages like Arabic) */
  two?: string;
  /** Form for few (used in some languages like Russian, Polish) */
  few?: string;
  /** Form for many (used in some languages like Russian, Arabic) */
  many?: string;
  /** Form for other (required - the fallback) */
  other: string;
}

// Cache Intl.PluralRules instances by locale for performance
const pluralRulesCache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

// Module-level locale sync for plural() function fallback
// This is set by IdiomaProvider and used when no explicit locale is passed
let _syncedLocale = 'en';

/**
 * Sync the current locale for the plural() function.
 * Called by IdiomaProvider to enable locale-aware pluralization
 * without requiring an explicit locale parameter.
 *
 * @internal
 */
export function _syncLocale(locale: string): void {
  _syncedLocale = locale;
}

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Select the appropriate plural form using CLDR rules via Intl.PluralRules.
 */
function selectPluralForm(
  value: number,
  forms: PluralForms,
  locale: string,
): string {
  // Handle explicit zero form (convenience, not a CLDR category for most languages)
  if (value === 0 && forms.zero !== undefined) {
    return forms.zero.replace(/#/g, String(value));
  }

  // Use Intl.PluralRules for locale-aware category selection
  const rules = getPluralRules(locale);
  const category = rules.select(value) as PluralCategory;

  // Use the matching category form, or fall back to 'other'
  const form = forms[category] ?? forms.other;

  // Replace # with the actual value
  return form.replace(/#/g, String(value));
}

/**
 * Pluralization function for use inside Trans and t() template literals.
 * In development, returns the appropriate form with # replaced by the value.
 * At compile time, this is serialized to ICU MessageFormat.
 *
 * @param value - The numeric value to pluralize
 * @param forms - Object with plural forms (one, other, etc.)
 * @param locale - Optional locale (uses synced locale from IdiomaProvider if not provided)
 *
 * @example
 * // In Trans component
 * <Trans>You have {plural(count, { one: '# item', other: '# items' })} in cart</Trans>
 *
 * @example
 * // In t() template literal
 * t(`You have ${plural(count, { one: '# item', other: '# items' })} in cart`)
 */
export function plural(
  value: number,
  forms: PluralForms,
  locale?: string,
): string {
  const effectiveLocale = locale ?? _syncedLocale;
  return selectPluralForm(value, forms, effectiveLocale);
}
