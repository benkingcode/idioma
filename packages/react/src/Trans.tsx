import { useContext, type ReactNode } from 'react';
import { IdiomaContext } from './context';
import { renderMessage, type TransComponent } from './interpolate';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageFunction = (args: any) => string | ReactNode;
type LocaleMessages = Record<string, string | MessageFunction>;

export interface TransProps {
  /** Translation object keyed by locale (may be undefined if Babel didn't transform) */
  __t?: LocaleMessages;
  /** Arguments for interpolation (named like "user.name" or numbered like "0") */
  __a?: Record<string, unknown>;
  /** Components for tag interpolation */
  __c?: TransComponent[];
  /** Component names for named tag matching (parallel to __c array) */
  __cn?: string[];
  /** Children (used as fallback when __t is missing) */
  children?: ReactNode;
}

/**
 * Internal Trans component used by Babel-compiled output.
 * Not intended for direct use - import Trans from the generated idioma/ folder instead.
 *
 * @example
 * // Compiled output:
 * <__Trans __t={__$idioma["key"]} __a={{ name }} __c={[Link]} />
 */
export function __Trans({
  __t,
  __a,
  __c,
  __cn,
  children,
}: TransProps): ReactNode {
  const context = useContext(IdiomaContext);
  if (!context) {
    throw new Error(
      '[idioma] Trans must be used within an IdiomaProvider. ' +
        'Make sure to wrap your app with <IdiomaProvider>.',
    );
  }

  // Graceful fallback when Babel didn't transform (missing __t)
  if (!__t) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        'Idioma: Missing translations. Ensure the Babel plugin is configured.',
      );
    }
    return children ?? null;
  }

  const { locale } = context;
  const msg = __t[locale];

  if (msg === undefined) {
    // Fallback: try to find any available message
    const fallback = Object.values(__t)[0];
    if (fallback === undefined) {
      return null;
    }
    return renderMessage(fallback, __a, __c, __cn);
  }

  return renderMessage(msg, __a, __c, __cn);
}
