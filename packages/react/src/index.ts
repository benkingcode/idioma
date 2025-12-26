// Main public exports for @idioma/react

// Factory functions for generated idioma/ folder
export {
  createTrans,
  type TransInlineModeProps,
  type TransKeyOnlyModeProps,
} from './createTrans';
export { createUseT, type TFunction } from './createUseT';

// Context and Provider factories
export {
  createIdiomaProvider,
  createUseLocale,
  IdiomaContext,
  type IdiomaContextValue,
  type IdiomaProviderProps,
} from './context';

// Runtime internals (used by Babel-compiled code)
export { __Trans, type TransProps } from './Trans';
export { __useT, type UseTOptions } from './useT';
export {
  interpolateValues,
  interpolateTags,
  type TransComponent,
} from './interpolate';
