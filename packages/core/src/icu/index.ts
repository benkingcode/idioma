// ICU MessageFormat utilities for pluralization and selection
// These are pure functions with no React dependency

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

/**
 * Forms for select() - exact value matching.
 * Keys are the possible values to match against.
 */
export interface SelectForms {
  /** Additional forms for exact value matching */
  [key: string]: string;
  /** Required fallback when no exact match found */
  other: string;
}

// Cache Intl.PluralRules instances by locale for performance (cardinal numbers)
const pluralRulesCache = new Map<string, Intl.PluralRules>();

// Separate cache for ordinal rules (ordinal numbers: 1st, 2nd, 3rd, etc.)
const ordinalRulesCache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

function getOrdinalRules(locale: string): Intl.PluralRules {
  let rules = ordinalRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale, { type: 'ordinal' });
    ordinalRulesCache.set(locale, rules);
  }
  return rules;
}

// Module-level locale sync for plural() function fallback
// This is set by IdiomiProvider and used when no explicit locale is passed
let _syncedLocale = 'en';

/**
 * Sync the current locale for the plural() function.
 * Called by IdiomiProvider to enable locale-aware pluralization
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
 * @param locale - Optional locale (uses synced locale from IdiomiProvider if not provided)
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

/**
 * Select the appropriate ordinal form using CLDR rules via Intl.PluralRules.
 * Used internally by selectOrdinal().
 */
function selectOrdinalForm(
  value: number,
  forms: PluralForms,
  locale: string,
): string {
  // Use Intl.PluralRules with ordinal type for locale-aware category selection
  const rules = getOrdinalRules(locale);
  const category = rules.select(value) as PluralCategory;

  // Use the matching category form, or fall back to 'other'
  const form = forms[category] ?? forms.other;

  // Replace # with the actual value
  return form.replace(/#/g, String(value));
}

/**
 * Ordinal pluralization function for use inside Trans and t() template literals.
 * Returns the appropriate ordinal form (1st, 2nd, 3rd, 4th, etc.) based on CLDR rules.
 * At compile time, this is serialized to ICU MessageFormat with selectordinal.
 *
 * @param value - The numeric value to format as ordinal
 * @param forms - Object with ordinal forms (one, two, few, other, etc.)
 * @param locale - Optional locale (uses synced locale from IdiomiProvider if not provided)
 *
 * @example
 * // English ordinals: 1st, 2nd, 3rd, 4th
 * // one = 1, 21, 31... (ends in 1, not 11)
 * // two = 2, 22, 32... (ends in 2, not 12)
 * // few = 3, 23, 33... (ends in 3, not 13)
 * // other = 4, 5, 11, 12, 13, 14...
 *
 * @example
 * // In Trans component
 * <Trans>You finished in {selectOrdinal(place, { one: '#st', two: '#nd', few: '#rd', other: '#th' })} place</Trans>
 *
 * @example
 * // In t() template literal
 * t(`Your ${selectOrdinal(position, { one: '#st', two: '#nd', few: '#rd', other: '#th' })} attempt`)
 */
export function selectOrdinal(
  value: number,
  forms: PluralForms,
  locale?: string,
): string {
  const effectiveLocale = locale ?? _syncedLocale;
  return selectOrdinalForm(value, forms, effectiveLocale);
}

/**
 * Selection function for exact value matching (gender, categories, etc.).
 * Unlike plural() and selectOrdinal(), this does simple string matching without CLDR rules.
 * At compile time, this is serialized to ICU MessageFormat with select.
 *
 * @param value - The string value to match against
 * @param forms - Object with forms for each possible value, plus 'other' as fallback
 *
 * @example
 * // Gender selection
 * <Trans>{select(gender, { male: 'He', female: 'She', other: 'They' })} liked your post</Trans>
 *
 * @example
 * // Category selection
 * t(`${select(status, { pending: 'Waiting', approved: 'Accepted', rejected: 'Denied', other: 'Unknown' })}`)
 */
export function select(value: string, forms: SelectForms): string {
  return forms[value] ?? forms.other;
}
