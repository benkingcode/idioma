/**
 * Type-level tests for useT hook.
 *
 * These tests verify that TypeScript correctly catches type errors.
 * The @ts-expect-error comments should suppress errors on invalid usage,
 * and valid usage should compile without errors.
 *
 * Run with: pnpm typecheck
 */

import { createUseT } from './createUseT';

// Mock translations object for testing
const translations = {
  greeting: {
    en: 'Hello',
    es: 'Hola',
  },
  'greeting.name': {
    en: (args: Record<string, unknown>) => `Hello ${args.name}`,
    es: (args: Record<string, unknown>) => `Hola ${args.name}`,
  },
  'items.count': {
    en: (args: Record<string, unknown>) =>
      args.count === 1 ? '1 item' : `${args.count} items`,
    es: (args: Record<string, unknown>) =>
      args.count === 1 ? '1 artículo' : `${args.count} artículos`,
  },
};

// Simulated generated types (what the compiler would produce)
type StringOnlyKey = 'greeting' | 'greeting.name' | 'items.count';

type MessageValues = {
  greeting: Record<string, never>;
  'greeting.name': { name: string | number };
  'items.count': { count: number };
};

// Create typed useT (simulating what idioma/index.ts exports)
const useT = createUseT<StringOnlyKey, MessageValues>(translations);

// Get the t function (in real usage this would be inside a component)
declare const t: ReturnType<typeof useT>;

// =============================================================================
// KEY-ONLY MODE TESTS
// =============================================================================

// --- Invalid key should error ---
// @ts-expect-error - 'nonexistent' is not a valid StringOnlyKey
t({ id: 'nonexistent' });

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
