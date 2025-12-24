import { Fragment, type ReactNode } from 'react';

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
 * Marker function for pluralization inside useT template literals.
 * In development, returns the appropriate form with # replaced by the value.
 * In production, this is compiled away entirely.
 *
 * @example
 * const t = useT()
 * const label = t`You have ${plural(count, { one: '# item', other: '# items' })} in your cart`
 */
export function plural(value: number, forms: PluralForms): string {
  // Dev-mode implementation using simple English-like plural rules
  // In production, this is compiled to ICU and then to JS conditionals

  let form: string;

  if (value === 0 && forms.zero !== undefined) {
    form = forms.zero;
  } else if (value === 1 && forms.one !== undefined) {
    form = forms.one;
  } else if (value === 2 && forms.two !== undefined) {
    form = forms.two;
  } else {
    // For dev mode, we don't implement full CLDR rules
    // Just use "other" as the fallback
    form = forms.other;
  }

  // Replace # with the actual value
  return form.replace(/#/g, String(value));
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
  other,
}: PluralProps): ReactNode {
  // Dev-mode implementation using simple English-like plural rules
  // In production, this is compiled to ICU and then to JS conditionals

  let form: string;

  if (value === 0 && zero !== undefined) {
    form = zero;
  } else if (value === 1 && one !== undefined) {
    form = one;
  } else if (value === 2 && two !== undefined) {
    form = two;
  } else {
    // For dev mode, we don't implement full CLDR rules
    // Just use "other" as the fallback
    form = other;
  }

  // Replace # with the actual value
  const text = form.replace(/#/g, String(value));

  return <Fragment>{text}</Fragment>;
}
