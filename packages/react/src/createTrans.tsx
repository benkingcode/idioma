'use client';

import { useContext, type ReactNode } from 'react';
import { IdiomiContext } from './context';
import { type TransComponent } from './interpolate';
import type {
  TransInlineModeProps,
  TransKeyOnlyModeProps,
} from './Trans.types';
import { type BaseIdiomiConfig } from './useT.types';

export type {
  TransInlineModeProps,
  TransKeyOnlyModeProps,
} from './Trans.types';

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
