import { useContext, type ReactNode } from 'react';
import { IdiomaContext } from './context';
import {
  interpolateTags,
  interpolateValues,
  type TransComponent,
} from './interpolate';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageFunction = (args: any) => string | ReactNode;
type LocaleMessages = Record<string, string | MessageFunction>;

export interface TransProps {
  /** Translation object keyed by locale */
  __t: LocaleMessages;
  /** Arguments for interpolation (named like "user.name" or numbered like "0") */
  __a?: Record<string, unknown>;
  /** Components for tag interpolation */
  __c?: TransComponent[];
}

/**
 * Internal Trans component used by Babel-compiled output.
 * Not intended for direct use - import Trans from the generated idioma/ folder instead.
 *
 * @example
 * // Compiled output:
 * <__Trans __t={__$idioma["key"]} __a={{ name }} __c={[Link]} />
 */
export function __Trans({ __t, __a, __c }: TransProps): ReactNode {
  const context = useContext(IdiomaContext);
  if (!context) {
    throw new Error(
      '[idioma] Trans must be used within an IdiomaProvider. ' +
        'Make sure to wrap your app with <IdiomaProvider>.',
    );
  }

  const { locale } = context;
  const msg = __t[locale];

  if (msg === undefined) {
    // Fallback: try to find any available message
    const fallback = Object.values(__t)[0];
    if (fallback === undefined) {
      return null;
    }
    if (typeof fallback === 'function') {
      return fallback(__a || {});
    }
    return fallback;
  }

  // Compiled plural/ICU: msg is a function
  if (typeof msg === 'function') {
    return msg(__a || {});
  }

  // String message - may need interpolation
  // Tag interpolation: replace <0>...</0> with React components
  // This must happen first if we have components, as it handles value interpolation too
  if (__c && __c.length > 0) {
    return interpolateTags(msg, __c, __a);
  }

  // Value interpolation only: replace {name} or {0} with values from __a
  if (__a) {
    return interpolateValues(msg, __a);
  }

  return msg;
}
