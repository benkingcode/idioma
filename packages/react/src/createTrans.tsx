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
  /** Translator context for key disambiguation (affects hash) */
  context?: string;
  /** Translator comment (extracted to PO #. comment for translators) */
  comment?: string;
  /** Namespace for large apps */
  ns?: string;
}

/**
 * Base props for key-only mode.
 */
interface TransKeyOnlyBaseProps<K extends string> {
  /** Translation key - must be a valid key from PO */
  id: K;
  /** No children allowed in key-only mode */
  children?: never;
  /** No context in key-only mode - message is defined in PO */
  context?: never;
  /** Namespace for large apps */
  ns?: string;
}

/**
 * Conditional values prop - required if message has placeholders.
 */
type TransValuesProps<
  K extends string,
  MV extends Record<string, Record<string, unknown>>,
> = K extends keyof MV
  ? MV[K] extends Record<string, never>
    ? { values?: never }
    : { values: MV[K] }
  : { values?: Record<string, unknown> };

/**
 * Conditional components prop - required if message has component tags.
 */
type TransComponentsProps<
  K extends string,
  MC extends Record<string, TransComponent[]>,
> = K extends keyof MC
  ? MC[K] extends []
    ? { components?: never }
    : { components: MC[K] }
  : { components?: TransComponent[] };

/**
 * Key-only mode props - when looking up by id.
 * Values are required if the message has {placeholders}.
 * Components are required if the message has <0>tags</0>.
 */
export type TransKeyOnlyModeProps<
  K extends string,
  MV extends Record<string, Record<string, unknown>>,
  MC extends Record<string, TransComponent[]>,
> = TransKeyOnlyBaseProps<K> &
  TransValuesProps<K, MV> &
  TransComponentsProps<K, MC>;

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
>(translations?: Translations) {
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
    const { id, values, components, ns } = props as TransKeyOnlyModeProps<
      TK,
      MV,
      MC
    > & { ns?: string };

    if (!id) {
      throw new Error('[idioma] Trans requires either children or id prop');
    }

    // When translations not provided (tree-shaking mode), Babel inlines them.
    // At runtime, key-only mode won't work without translations.
    if (!translations) {
      console.warn(
        `[idioma] Trans with id="${id}" requires translations. ` +
          'Make sure Babel is transforming your code in production.',
      );
      return id;
    }

    // Get locale messages from the right place (namespace or top-level)
    let localeMessages: LocaleMessages | undefined;
    if (ns) {
      // Look in __ns.{namespace}.{id}
      const nsTranslations = (
        translations as unknown as { __ns?: Record<string, Translations> }
      ).__ns;
      localeMessages = nsTranslations?.[ns]?.[id];
    } else {
      // Look at top level
      localeMessages = translations[id];
    }

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
