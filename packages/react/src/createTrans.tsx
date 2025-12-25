import { useContext, type ReactNode } from 'react';
import { IdiomaContext } from './context';
import {
  interpolateTags,
  interpolateValues,
  type TransComponent,
} from './interpolate';

type MessageFunction = (args: Record<string, unknown>) => string | ReactNode;
type LocaleMessages = Record<string, string | MessageFunction>;
type Translations = Record<string, LocaleMessages>;

/**
 * Inline mode props - when children are present.
 * Used for development and extracted by Babel in production.
 */
export interface TransInlineModeProps {
  children: ReactNode;
  /** Optional explicit key (overrides auto-hash) */
  id?: string;
  /** Translator context (extracted to PO, stripped from bundle) */
  context?: string;
  /** Namespace for large apps */
  ns?: string;
}

/**
 * Key-only mode props - when looking up by id.
 * Requires id, optionally values and components based on the message.
 */
export interface TransKeyOnlyModeProps<
  K extends string,
  MV extends Record<string, Record<string, unknown>>,
  MC extends Record<string, TransComponent[]>,
> {
  /** Translation key - must be a valid key from PO */
  id: K;
  /** No children allowed in key-only mode */
  children?: never;
  /** No context in key-only mode - message is defined in PO */
  context?: never;
  /** Namespace for large apps */
  ns?: string;
  /** Values for {name} placeholders - required if message has placeholders */
  values?: K extends keyof MV ? MV[K] : Record<string, unknown>;
  /** Components for <0>...</0> tags - required if message has tags */
  components?: K extends keyof MC ? MC[K] : TransComponent[];
}

/**
 * Creates a typed Trans component that supports both inline and key-only modes.
 *
 * @example
 * // In generated idioma/index.ts:
 * export const Trans = createTrans<TranslationKey, MessageValues, MessageComponents>(translations)
 *
 * // Inline mode (dev, Babel extracts):
 * <Trans>Hello {name}</Trans>
 *
 * // Key-only mode (typed lookup):
 * <Trans id="welcome" values={{ name: "Ben" }} />
 * <Trans id="legal.links" components={[TermsLink, PrivacyLink]} />
 */
export function createTrans<
  TK extends string = string,
  MV extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
  MC extends Record<string, TransComponent[]> = Record<
    string,
    TransComponent[]
  >,
>(translations: Translations) {
  function Trans(props: TransInlineModeProps): ReactNode;
  function Trans<K extends TK>(
    props: TransKeyOnlyModeProps<K, MV, MC>,
  ): ReactNode;
  function Trans(
    props: TransInlineModeProps | TransKeyOnlyModeProps<TK, MV, MC>,
  ): ReactNode {
    const ctx = useContext(IdiomaContext);
    if (!ctx) {
      throw new Error(
        '[idioma] Trans must be used within an IdiomaProvider. ' +
          'Make sure to wrap your app with <IdiomaProvider>.',
      );
    }

    const { locale } = ctx;

    // Inline mode: children present - render them directly
    // In production, Babel transforms this to __Trans
    if ('children' in props && props.children !== undefined) {
      return props.children;
    }

    // Key-only mode: lookup from translations
    const { id, values, components } = props as TransKeyOnlyModeProps<
      TK,
      MV,
      MC
    >;

    if (!id) {
      throw new Error('[idioma] Trans requires either children or id prop');
    }

    const localeMessages = translations[id];
    if (!localeMessages) {
      return id; // Fallback to key
    }

    const msg = localeMessages[locale] ?? Object.values(localeMessages)[0];
    if (msg === undefined) {
      return id;
    }

    // Compiled plural/ICU: msg is a function
    if (typeof msg === 'function') {
      return msg(values || {});
    }

    // Component interpolation: replace <0>...</0> with React components
    if (components && components.length > 0) {
      return interpolateTags(msg, components, values);
    }

    // Value interpolation only: replace {name} with values
    if (values && Object.keys(values).length > 0) {
      return interpolateValues(msg, values);
    }

    return msg;
  }

  return Trans;
}
