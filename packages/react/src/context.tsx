import { _syncLocale } from '@idioma/core/icu';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

export interface IdiomaContextValue {
  locale: string;
  /** The source locale, which a missing translation falls back to */
  defaultLocale?: string;
}

export const IdiomaContext = createContext<IdiomaContextValue | null>(null);

export interface IdiomaProviderProps {
  children: ReactNode;
  locale: string;
}

export interface IdiomaProviderOptions {
  /**
   * The source locale. A message with no translation for the current
   * locale (or its base locale) renders this locale's text, then the source
   * text or id. The generated idioma/index.ts passes it.
   */
  defaultLocale?: string;
}

/**
 * Creates an IdiomaProvider component that provides locale context to children.
 *
 * @example
 * const IdiomaProvider = createIdiomaProvider()
 *
 * function App() {
 *   return (
 *     <IdiomaProvider locale="en">
 *       <Router />
 *     </IdiomaProvider>
 *   )
 * }
 */
export function createIdiomaProvider(options: IdiomaProviderOptions = {}) {
  const { defaultLocale } = options;
  return function IdiomaProvider({ children, locale }: IdiomaProviderProps) {
    const value = useMemo(() => ({ locale, defaultLocale }), [locale]);

    // Sync locale for plural() function fallback
    // Sync immediately for SSR (before effects run)
    _syncLocale(locale);

    // Also sync in effect for client-side updates
    useEffect(() => {
      _syncLocale(locale);
    }, [locale]);

    return (
      <IdiomaContext.Provider value={value}>{children}</IdiomaContext.Provider>
    );
  };
}

/**
 * Creates a useLocale hook that returns the current locale from context.
 *
 * @throws Error if used outside of IdiomaProvider
 *
 * @example
 * const useLocale = createUseLocale()
 *
 * function Component() {
 *   const locale = useLocale()
 *   return <div>Current locale: {locale}</div>
 * }
 */
export function createUseLocale() {
  return function useLocale(): string {
    const context = useContext(IdiomaContext);
    if (!context) {
      throw new Error(
        '[idioma] useLocale must be used within an IdiomaProvider. ' +
          'Make sure to wrap your app with <IdiomaProvider>.',
      );
    }
    return context.locale;
  };
}
