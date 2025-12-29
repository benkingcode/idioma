'use client';

import { _syncLocale } from '@idiomi/core/icu';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

export interface IdiomiContextValue {
  locale: string;
}

export const IdiomiContext = createContext<IdiomiContextValue | null>(null);

export interface IdiomiProviderProps {
  children: ReactNode;
  locale: string;
}

/**
 * Creates an IdiomiProvider component that provides locale context to children.
 *
 * @example
 * const IdiomiProvider = createIdiomiProvider()
 *
 * function App() {
 *   return (
 *     <IdiomiProvider locale="en">
 *       <Router />
 *     </IdiomiProvider>
 *   )
 * }
 */
export function createIdiomiProvider() {
  return function IdiomiProvider({ children, locale }: IdiomiProviderProps) {
    const value = useMemo(() => ({ locale }), [locale]);

    // Sync locale for plural() function fallback
    // Sync immediately for SSR (before effects run)
    _syncLocale(locale);

    // Also sync in effect for client-side updates
    useEffect(() => {
      _syncLocale(locale);
    }, [locale]);

    return (
      <IdiomiContext.Provider value={value}>{children}</IdiomiContext.Provider>
    );
  };
}

/**
 * Creates a useLocale hook that returns the current locale from context.
 *
 * @throws Error if used outside of IdiomiProvider
 *
 * @example
 * const useLocale = createUseLocale<Locale>()
 *
 * function Component() {
 *   const locale = useLocale() // typed as Locale
 *   return <div>Current locale: {locale}</div>
 * }
 */
export function createUseLocale<L extends string = string>() {
  return function useLocale(): L {
    const context = useContext(IdiomiContext);
    if (!context) {
      throw new Error(
        '[idiomi] useLocale must be used within an IdiomiProvider. ' +
          'Make sure to wrap your app with <IdiomiProvider>.',
      );
    }
    return context.locale as L;
  };
}
