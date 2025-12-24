// Main public exports for @idioma/react

// Context and Provider
export {
  createIdiomaProvider,
  createUseLocale,
  IdiomaContext,
  type IdiomaContextValue,
  type IdiomaProviderProps,
} from './context';

// Pluralization (dev-time)
export {
  Plural,
  plural,
  type PluralForms,
  type PluralProps,
} from './pluralization';

// Runtime internals (used by compiled code)
export { __Trans, type TransProps } from './Trans';
export { __useT, type UseTOptions } from './useT';
export {
  interpolateValues,
  interpolateTags,
  type TransComponent,
} from './interpolate';
