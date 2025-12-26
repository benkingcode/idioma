/**
 * Type-level tests for useT hook and Trans component.
 *
 * These tests verify that TypeScript correctly catches type errors.
 * The @ts-expect-error comments should suppress errors on invalid usage,
 * and valid usage should compile without errors.
 *
 * Run with: pnpm typecheck
 */

import { createTrans } from './createTrans';
import { createUseT } from './createUseT';
import type { TransComponent } from './interpolate';

// Simulated generated types (what the compiler would produce)
// All types bundled into a single IdiomaTypes interface for cleaner API
interface IdiomaTypes {
  TranslationKey: 'greeting' | 'greeting.name' | 'items.count' | 'legal.links';
  MessageValues: {
    greeting: Record<string, never>;
    'greeting.name': { name: string | number };
    'items.count': { count: number };
    'legal.links': Record<string, never>;
  };
  MessageComponents: {
    greeting: [];
    'greeting.name': [];
    'items.count': [];
    'legal.links': [TransComponent, TransComponent];
  };
}

// Create typed useT (simulating what idioma/index.ts exports)
// Single type parameter instead of 3!
const useT = createUseT<IdiomaTypes>();

// Get the t function (in real usage this would be inside a component)
declare const t: ReturnType<typeof useT>;

// =============================================================================
// KEY-ONLY MODE TESTS
// =============================================================================

// --- Invalid key should error ---
// @ts-expect-error - 'nonexistent' is not a valid key
t({ id: 'nonexistent' });

// --- Keys with component tags should error (must use Trans instead) ---
// @ts-expect-error - 'legal.links' has component tags, can't use with useT
t({ id: 'legal.links' });

// --- Missing values for key with placeholders should error ---
// @ts-expect-error - 'greeting.name' requires values: { name }
t({ id: 'greeting.name' });

// --- Wrong values shape should error ---
// @ts-expect-error - 'greeting.name' needs { name }, not { wrong }
t({ id: 'greeting.name', values: { wrong: 'x' } });

// @ts-expect-error - 'items.count' needs { count }, not { name }
t({ id: 'items.count', values: { name: 'Ben' } });

// --- Valid key-only usage should work ---
t({ id: 'greeting' }); // No values needed
t({ id: 'greeting.name', values: { name: 'Ben' } });
t({ id: 'greeting.name', values: { name: 42 } }); // number also valid
t({ id: 'items.count', values: { count: 5 } });

// --- With optional context/ns ---
t({ id: 'greeting', context: 'modal' });
t({ id: 'greeting', ns: 'common' });
t({
  id: 'greeting.name',
  values: { name: 'Ben' },
  context: 'header',
  ns: 'app',
});

// =============================================================================
// SOURCE TEXT MODE TESTS
// =============================================================================

// --- Missing values for source with placeholders should error ---
// @ts-expect-error - 'Hello {name}' has placeholder, needs values
t('Hello {name}');

// --- Wrong values shape should error ---
// @ts-expect-error - needs { name }, not { wrong }
t('Hello {name}', { wrong: 'x' });

// @ts-expect-error - needs { name, count }, got only { name }
t('Hello {name}, you have {count} items', { name: 'Ben' });

// --- Extra values not in template should error ---
// @ts-expect-error - { extra } is not in the template
t('Hello {name}', { name: 'Ben', extra: 'x' });

// --- Valid source text usage should work ---
t('Hello {name}', { name: 'Ben' });
t('Hello {name}', { name: 42 }); // number also valid
t('Hello {name}, you have {count} items', { name: 'Ben', count: 5 });
t('No placeholders here'); // No values needed

// --- With options (3rd argument) ---
t('Submit', undefined, { context: 'button' });
t('Hello {name}', { name: 'Ben' }, { context: 'greeting' });
t('Hello {name}', { name: 'Ben' }, { context: 'greeting', ns: 'common' });

// =============================================================================
// EDGE CASES
// =============================================================================

// --- Empty string should work without values ---
t('');

// --- Curly braces that aren't placeholders ---
// These are tricky - { without matching } or escaped braces
// For now, the simple regex will treat {foo as a placeholder start
// This is a known limitation - ICU syntax like {count, plural, ...} will be parsed

// --- Multiple same placeholders should only require one value ---
t('Hello {name}, goodbye {name}', { name: 'Ben' });

// =============================================================================
// TRANS COMPONENT (createTrans)
// =============================================================================

// Create typed Trans (simulating what idioma/index.ts exports)
// Single type parameter instead of 3!
const Trans = createTrans<IdiomaTypes>();

// Mock components for testing
declare const TermsLink: TransComponent;
declare const PrivacyLink: TransComponent;

// === Invalid key should error ===

// @ts-expect-error - 'nonexistent' is not a valid TranslationKey
<Trans id="nonexistent" />;

// === Missing values for key with placeholders should error ===

// @ts-expect-error - 'greeting.name' requires values: { name }
<Trans id="greeting.name" />;

// === Wrong values shape should error ===

// @ts-expect-error - 'greeting.name' needs { name }, not { wrong }
<Trans id="greeting.name" values={{ wrong: 'x' }} />;

// === Missing components for key with tags should error ===

// @ts-expect-error - 'legal.links' requires components
<Trans id="legal.links" />;

// @ts-expect-error - 'legal.links' requires 2 components, not 1
<Trans id="legal.links" components={[TermsLink]} />;

// === Valid Trans usage ===

// Key without values or components
<Trans id="greeting" />;

// Key with values
<Trans id="greeting.name" values={{ name: 'Ben' }} />;
<Trans id="items.count" values={{ count: 5 }} />;

// Key with components
<Trans id="legal.links" components={[TermsLink, PrivacyLink]} />;

// Inline mode (children present)
<Trans>Hello world</Trans>;
<Trans context="button">Submit</Trans>;
