/**
 * Shared types for Trans component (both inlined and suspense modes).
 */

import type { ReactNode } from 'react';
import type { TransComponent } from './interpolate';

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
 * Base props for key-only mode (shared between inlined and suspense).
 */
export interface TransKeyOnlyBaseProps<K extends string> {
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
export type TransValuesProps<
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
export type TransComponentsProps<
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
