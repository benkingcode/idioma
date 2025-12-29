// Main public exports for @idiomi/react

// Factory functions for generated idiomi/ folder
export {
  createTrans,
  type TransInlineModeProps,
  type TransKeyOnlyModeProps,
} from './createTrans';
export { createUseT, type TFunction } from './createUseT';

// Context and Provider factories
export {
  createIdiomiProvider,
  createUseLocale,
  IdiomiContext,
  type IdiomiContextValue,
  type IdiomiProviderProps,
} from './context';

// Runtime internals (used by Babel-compiled code)
export { __Trans, type TransProps } from './Trans';
export { __useT, type UseTOptions } from './useT';
export {
  interpolateValues,
  interpolateTags,
  type TransComponent,
} from './interpolate';

// SEO utilities
export {
  getLocaleHead,
  type GetLocaleHeadOptions,
  type LocaleHeadData,
  type HreflangLink,
  type RoutesMap,
} from './getLocaleHead';
