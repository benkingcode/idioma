import { createContext, useContext, useMemo, type ReactNode } from 'react'

export interface IdiomaContextValue {
  locale: string
}

export const IdiomaContext = createContext<IdiomaContextValue | null>(null)

export interface IdiomaProviderProps {
  children: ReactNode
  locale: string
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
export function createIdiomaProvider() {
  return function IdiomaProvider({ children, locale }: IdiomaProviderProps) {
    const value = useMemo(() => ({ locale }), [locale])

    return (
      <IdiomaContext.Provider value={value}>{children}</IdiomaContext.Provider>
    )
  }
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
    const context = useContext(IdiomaContext)
    if (!context) {
      throw new Error(
        '[idioma] useLocale must be used within an IdiomaProvider. ' +
          'Make sure to wrap your app with <IdiomaProvider>.'
      )
    }
    return context.locale
  }
}
