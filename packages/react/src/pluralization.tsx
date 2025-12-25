import { Fragment, useContext, type ReactNode } from 'react';
import { IdiomaContext } from './context';

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
 * Marker function for pluralization inside useT template literals.
 * In development, returns the appropriate form with # replaced by the value.
 * In production, this is compiled away entirely.
 *
 * @param value - The numeric value to pluralize
 * @param forms - Object with plural forms (one, other, etc.)
 * @param locale - Optional locale (uses synced locale from IdiomaProvider if not provided)
 *
 * @example
 * const t = useT()
 * const label = t`You have ${plural(count, { one: '# item', other: '# items' })} in your cart`
 */
export function plural(
  value: number,
  forms: PluralForms,
  locale?: string,
): string {
  const effectiveLocale = locale ?? _syncedLocale;
  return selectPluralForm(value, forms, effectiveLocale);
}

export interface PluralProps {
  /** The numeric value to pluralize */
  value: number;
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
 * Plural component for use within Trans.
 * In development, renders the appropriate form with # replaced by the value.
 * In production, this component is compiled away entirely.
 *
 * Uses CLDR plural rules via Intl.PluralRules for locale-aware pluralization.
 * The locale is automatically obtained from IdiomaContext.
 *
 * @example
 * <Trans>
 *   You have <Plural value={count} one="# item" other="# items" /> in your cart
 * </Trans>
 */
export function Plural({
  value,
  zero,
  one,
  two,
  few,
  many,
  other,
}: PluralProps): ReactNode {
  // Get locale from context, fallback to 'en' if no provider
  const context = useContext(IdiomaContext);
  const locale = context?.locale ?? 'en';

  const forms: PluralForms = { zero, one, two, few, many, other };
  const text = selectPluralForm(value, forms, locale);

  return <Fragment>{text}</Fragment>;
}
