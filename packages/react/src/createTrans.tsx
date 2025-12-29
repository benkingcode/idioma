'use client';

import { useContext, type ReactNode } from 'react';
import { IdiomiContext } from './context';
import { type BaseIdiomiConfig } from './createUseT';
import { type TransComponent } from './interpolate';

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
 * // In generated idiomi/index.ts:
 * export const Trans = createTrans<IdiomiTypes>()
 *
 * // Inline mode (dev, Babel extracts):
 * <Trans>Hello {name}</Trans>
 *
 * // Key-only mode (typed lookup):
 * <Trans id="welcome" values={{ name: "Ben" }} />
 * <Trans id="legal.links" components={[TermsLink, PrivacyLink]} />
 */
export function createTrans<C extends BaseIdiomiConfig = BaseIdiomiConfig>() {
  // Extract types from config
  type TK = C['TranslationKey'];
  type MV = C['MessageValues'];
  type MC = C['MessageComponents'];

  /**
   * Trans component for inline translations.
   *
   * In development and production, Babel transforms Trans to __Trans with
   * inlined translations. This function exists for type safety and to provide
   * a fallback when Babel hasn't transformed the code.
   */
  function Trans(props: TransInlineModeProps): ReactNode;
  function Trans<K extends TK>(
    props: TransKeyOnlyModeProps<
      K & string,
      MV,
      MC & Record<string, TransComponent[]>
    >,
  ): ReactNode;
  function Trans(
    props:
      | TransInlineModeProps
      | TransKeyOnlyModeProps<
          TK & string,
          MV,
          MC & Record<string, TransComponent[]>
        >,
  ): ReactNode {
    const ctx = useContext(IdiomiContext);
    if (!ctx) {
      throw new Error(
        '[idiomi] Trans must be used within an IdiomiProvider. ' +
          'Make sure to wrap your app with <IdiomiProvider>.',
      );
    }

    // Inline mode: children present - render them directly
    // Babel transforms this to __Trans with inlined translations
    if ('children' in props && props.children !== undefined) {
      return props.children;
    }

    // Key-only mode: Babel should transform this too
    // If we reach here, Babel hasn't transformed the code
    const { id } = props as TransKeyOnlyModeProps<
      TK & string,
      MV,
      MC & Record<string, TransComponent[]>
    >;
    if (id) {
      console.warn(
        `[idiomi] Trans with id="${id}" was not transformed by Babel. ` +
          'Make sure @idiomi/core Babel plugin is configured.',
      );
      return id;
    }

    throw new Error('[idiomi] Trans requires either children or id prop');
  }

  return Trans;
}
