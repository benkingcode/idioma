# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Test-Driven Development (TDD)

**TDD is mandatory for all code changes in this repository.**

Follow the red-green-refactor cycle:

1. **Red**: Write a failing test first that defines the expected behavior
2. **Green**: Write the minimum code necessary to make the test pass
3. **Refactor**: Clean up the code while keeping tests green

### TDD Workflow

1. Before implementing any feature or fix, write tests that specify the desired behavior
2. Run the test to confirm it fails (this validates the test is meaningful)
3. Implement the code to make the test pass
4. Run all related tests to ensure nothing broke
5. Refactor if needed, re-running tests after each change

### Practical Guidelines

- **New features**: Write tests for the expected API/behavior before writing the implementation
- **Bug fixes**: Write a test that reproduces the bug before fixing it
- **Refactoring**: Ensure comprehensive tests exist before refactoring; run them frequently during the process

```bash
# Run tests in watch mode during development
pnpm test --watch

# Run a specific test file
pnpm test packages/core/src/babel/plugin.test.ts
```

## Task Completion Checklist

**Before considering any task complete, you MUST:**

1. **Run TypeScript type checking**: `pnpm typecheck`
   - Fix ALL type errors before marking the task as done
   - Do not skip this step, even for "small" changes
2. **Run tests**: `pnpm test` (or relevant test file)
   - Ensure all tests pass
3. **Verify no regressions**: Check that existing functionality still works

If any of these checks fail, the task is NOT complete. Fix the issues before proceeding.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode (rebuilds on file changes)
pnpm dev

# Run all tests (unit tests via Vitest)
pnpm test

# Run a single test file
pnpm test packages/core/src/babel/plugin.test.ts

# Type check all packages
pnpm typecheck

# Clean build artifacts
pnpm clean

# E2E tests (Playwright) - run from repo root
pnpm test:e2e            # Run all e2e tests
pnpm test:e2e:ui         # Run with Playwright UI
```

## Developing the Library

**When modifying `@idioma/core` or `@idioma/react`**, you must rebuild for changes to be visible to:

- E2E test fixtures (`e2e/fixtures/*`)
- Example apps (`examples/*`)

Use one of these approaches:

1. **Watch mode** (recommended for active development):

   ```bash
   pnpm dev  # Watches both packages, rebuilds on change
   ```

2. **Manual build** (one-time rebuild):
   ```bash
   pnpm build
   ```

The E2E fixtures and examples import from the compiled `dist/` directories, not the source files directly. Forgetting to rebuild is a common source of confusion when changes "don't work".

## Architecture

Idioma is a compile-time React i18n library. Translations are extracted, stored in PO files, and compiled to optimized JavaScript at build time.

### Packages

**@idioma/core** (`packages/core/`) - Build tools and CLI

- `babel/` - Babel plugin that transforms `<Trans>` components and extracts messages
- `bundler/` - Vite, Next.js, and Metro plugins for build integration
- `cli/` - CLI commands: `extract`, `compile`, `check`, `stats`, `translate`
- `compiler/` - Compiles PO files to JS/TS with typed exports
- `icu/` - ICU MessageFormat parser and compiler
- `po/` - PO file parser and merge utilities
- `keys/` - Message key generation (murmurhash-based)
- `ai/` - AI translation: context generation from source code, unified provider via Vercel AI SDK

**@idioma/react** (`packages/react/`) - Runtime components

- `Trans` component and `createTrans` factory (compiled output uses `__Trans`)
- `useT` hook and `createUseT` factory (compiled output uses `__useT`)
- `IdiomaContext` and `IdiomaProvider` for locale state
- `interpolate` for placeholder/tag substitution
- `runtime-suspense/` - Suspense-based lazy loading (React 19+)
- `server/` - Server-side rendering utilities

### Configuration

Projects use `idioma.config.ts`:

```typescript
import { defineConfig } from '@idioma/core';

export default defineConfig({
  idiomaDir: './src/idioma',
  // Optional: override PO file location if you have existing translations elsewhere
  // localesDir: './locales',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
});
```

### Folder Structure

The `idiomaDir` contains all Idioma files:

```
src/idioma/
├── .gitignore           # Auto-generated (ignores .generated/)
├── locales/             # PO files (git tracked)
│   ├── en.po
│   └── es.po
├── index.ts             # User import: Trans, useT, etc.
├── plain.ts             # User import: createT (non-React)
└── .generated/          # Internal files (gitignored)
    ├── translations.js
    └── types.ts
```

---

## How the Library Works

### High-Level Flow

```
Source Code → Babel Plugin → PO Files → Compiler → JavaScript → Runtime
     ↓              ↓            ↓          ↓           ↓
  <Trans>       Extract      Translate   Compile    Render
  useT()        messages     (manual/AI)  to JS     message
```

**Two-Phase Compilation**: Extraction (code → PO) is separate from compilation (PO → JS). This enables manual editing and TMS (Translation Management System) integration.

### Babel Plugin Transformations

The Babel plugin (`packages/core/src/babel/plugin.ts`) has two modes:

```typescript
mode?: 'inlined' | 'suspense'; // default: 'inlined'
```

#### Inlined Mode (`mode: 'inlined'`) — Default

Transforms components to internal versions with pre-compiled translations baked in:

```tsx
// Before transformation
<Trans>Hello {name}</Trans>

// After transformation
<__Trans
  __t={{ en: "Hello {name}", es: "Hola {name}" }}
  __a={{ name }}
/>
```

For `useT()`:

```tsx
// Before (source text mode)
const t = useT();
t('Hello {name}', { name: 'Ben' });

// After (Babel inlines translations as 2nd arg via __m marker)
t('Hello {name}', { __m: { en: '...', es: '...' } }, { name: 'Ben' });
```

```tsx
// Before (object form with explicit id)
t({ id: 'greeting', source: 'Hello {name}', values: { name: 'Ben' } });

// After (Babel normalizes to string form + inlines translations)
t('Hello {name}', { __m: { en: '...', es: '...' } }, { name: 'Ben' });
// Without source: t({ id: 'key' }) → t('key', { __m: { en: '...', es: '...' } })
```

#### Suspense Mode (`mode: 'suspense'`) — For lazy loading (React 19+)

Uses dynamic imports with React 19's `use()` hook for lazy loading:

```tsx
// Babel injects at file level:
import { __TransSuspense } from '@idioma/react/runtime-suspense';
const __$idiomaChunk = "src_components_Header";
const __$idiomaLoad = {
  en: () => import('./chunks/src_components_Header.en'),
  es: () => import('./chunks/src_components_Header.es')
};

// Then transforms:
<Trans>Hello</Trans>
// becomes:
<__TransSuspense __key="abc123" __chunk={__$idiomaChunk} __load={__$idiomaLoad} />
```

#### Prop Meanings (for transformed code)

- `__t`: Translation object `{ locale: translatedString | function }`
- `__a`: Arguments for placeholders `{ name: value }`
- `__c`: Component array for tag interpolation
- `__cn`: Component names for named tag matching (parallel to `__c`)
- `__ns`: Optional namespace

#### Import Detection

The plugin uses `idiomaDir` config to detect imports from the user's idioma folder (not from `@idioma/react` directly). This allows Babel to distinguish user Trans components from other libraries.

#### Binding Tracking

Tracks aliased imports and derived functions:

```tsx
import { createT, Trans as T, useT } from './idioma';

const CustomTrans = Trans; // tracked
const t = useT(); // tracked as 't' binding
```

### Key Generation

**File**: `packages/core/src/keys/generator.ts`

**Algorithm**: MurmurHash3 (32-bit) → Base62 encoding → 8 characters

```typescript
generateKey('Hello, world!'); // => "k8Jf2mN4"
generateKey('Submit', 'button'); // Different hash (context affects key)
generateKey('Submit', undefined, 'auth'); // Different hash (namespace affects key)
```

**Input Format**:

```
{namespace}\u0005{context}\u0004{message}
```

- Context separator: `\u0004` (ASCII EOT)
- Namespace separator: `\u0005` (ASCII ENQ)

**Why content-addressable?**

- Same source text always gets same key
- Translations survive code refactoring
- No manual key management needed
- 8 chars = ~62^8 = 218 trillion combinations (collision-resistant)

### ICU MessageFormat

#### At Build Time - Extraction

`packages/core/src/babel/serialize.ts` converts helper functions to ICU format:

```tsx
// Source code:
{
  plural(count, { one: '# item', other: '# items' });
}

// Serialized to PO:
('{count, plural, one {# item} other {# items}}');
```

Also handles `select()` and `selectOrdinal()`:

```tsx
select(gender, { male: 'He', female: 'She', other: 'They' });
// => "{gender, select, male {He} female {She} other {They}}"
```

#### At Build Time - Compilation

`packages/core/src/compiler/compile.ts` compiles ICU to JavaScript functions:

```po
# PO entry:
msgstr "{count, plural, one {# item} other {# items}}"
```

```javascript
// Compiled to:
(args) => {
  const v = Number(args.count);
  const pr = new Intl.PluralRules('en');
  const cat = pr.select(v);
  if (cat === 'one') {
    return String(v) + ' item';
  }
  return String(v) + ' items';
};
```

#### Runtime ICU Helpers (source code only)

`packages/core/src/icu/index.ts` provides `plural()`, `select()`, and `selectOrdinal()` helpers that developers use in source code:

```tsx
<Trans>You have {plural(count, { one: '# item', other: '# items' })}</Trans>
```

These helpers are only used during extraction to serialize to ICU format. At runtime, the compiled JS functions handle the logic directly—the helper functions aren't called in production.

### Runtime Behavior

Since bundlers always use inlined or suspense mode, here's what actually runs:

#### Trans Component (`packages/react/src/Trans.tsx`)

**Inlined Mode** — `__Trans` component:

- Receives pre-compiled translations via `__t` prop
- Uses `IdiomaContext` to get current locale
- Calls `renderMessage()` which handles:
  1. ICU functions (plurals/selects compiled to JS functions)
  2. Component tag interpolation (`<Link>text</Link>`)
  3. Value interpolation (`{name}`)

**Suspense Mode** — `__TransSuspense` component (`packages/react/src/runtime-suspense/`):

- Uses React 19's `use()` hook
- Suspends while translations load via dynamic import
- Module-level cache prevents re-fetching

#### useT Hook (`packages/react/src/createUseT.tsx`)

**Inlined Mode**:

- Detects if 2nd arg is Babel-inlined translations (has `__m` marker: `{ __m: { locale: translation } }`)
- Uses inlined data when present
- Falls back to runtime lookup for dynamic strings (rare edge case)

**Suspense Mode** — `__useTSuspense`:

- Receives chunk ID and loader from Babel
- Uses `use()` hook for loading
- Returns function that looks up by key in loaded chunk

#### Interpolation System

`packages/react/src/interpolate.ts` handles:

**Value Interpolation**:

```typescript
interpolateValues('Hello {name}', { name: 'Ben' });
// => "Hello Ben"
```

**Tag Interpolation** - Recursive parser that handles:

- Named tags: `<Link>click</Link>`
- Numbered tags: `<0>click</0>` (legacy)
- Self-closing: `<Icon/>`
- Nested tags: `<Bold>outer <Italic>inner</Italic></Bold>`

Component matching uses `__cn` array for duplicate name resolution:

```tsx
// Source: <Trans components={[LinkA, LinkB]}>...</Trans>
// __c = [LinkA, LinkB]
// __cn = ['Link', 'Link']
// Translation: "Click <Link>here</Link> or <Link>there</Link>"
// Result: First Link → LinkA, Second Link → LinkB
```

### PO File Handling

#### Parsing (`packages/core/src/po/parser.ts`)

Uses `gettext-parser` library:

- Supports flat structure (`en.po`) and namespaced (`en/common.po`)
- Key format includes context: `{context}\u0004{msgid}` when context present

**Message Structure**:

```typescript
interface Message {
  key: string; // Hash or explicit ID
  source: string; // Original msgid
  translation: string; // msgstr
  context?: string; // msgctxt
  namespace?: string; // From file location
  references?: string[]; // Source locations
  comments?: string[]; // Translator comments
  flags?: string[]; // e.g., "extracted", "fuzzy"
}
```

#### Merging (`packages/core/src/po/merge.ts`)

**Full Catalog Merge** (`mergeCatalogs`):

- Adds new messages with source text as initial translation
- Updates references and comments for existing messages
- Preserves existing translations
- Clean mode: removes orphaned messages **only if** they have `extracted` flag

**Incremental File Merge** (`mergeFileIntoCatalog`):
For dev mode incremental extraction:

1. Remove file path from all message references
2. Add file path to extracted message references
3. Find orphaned messages (no references)
4. Only remove if: has `extracted` flag AND no translations in other locales

This prevents auto-deletion of TMS-imported messages.

#### Flag System

- `extracted`: Idioma-created message (can be auto-deleted when orphaned)
- No flag: Likely TMS-imported (preserved forever)

### AI Translation

`packages/core/src/ai/` provides two AI features:

#### Context Generation (`context.ts`)

Analyzes source code to add translator context:

1. Group messages by source file
2. For each file:
   - Read source code
   - Send to AI with message list and line numbers
   - AI analyzes code context
   - Add as PO comments with `[AI Context]:` prefix

```po
#. [AI Context]: Button label in checkout form to confirm purchase
msgid "abc123"
msgstr "Confirm Payment"
```

**Smart Detection**:

```typescript
needsContextGeneration(message) {
  // Skip if has explicit context (msgctxt)
  // Skip if already has any comments
}
```

#### Translation (`provider.ts`)

Batch translates messages with system prompt that ensures:

- Preserve placeholders: `{name}`, `{count}`, `{0}`
- Preserve component tags: `<0>...</0>`, `<Link>...</Link>`
- Preserve ICU syntax: `{count, plural, one {...} other {...}}`
- Keep whitespace exact
- Don't translate brand names

**Providers**:

Uses the [Vercel AI SDK](https://ai-sdk.dev/) for unified provider access. Users configure `ai.model` in their config with any `LanguageModel` from `@ai-sdk/*` packages (anthropic, openai, google, etc.). Translation uses `generateText()` with `Output.object()` for structured output.

**Dry Run Mode**:

Use `--dry-run --verbose` to inspect AI prompts without making API calls:

```bash
idioma translate --dry-run --verbose
```

This creates a mock provider (`createDryRunProvider`) that returns "Dry run" for all translations. Useful for debugging guidelines and reviewing what context the AI receives.

### Bundler Integration

#### Vite Plugin (`packages/core/src/bundler/vite.ts`)

**Lifecycle**: `configResolved → buildStart → handleHotUpdate (dev only)`

**buildStart**:

1. Load `idioma.config.ts`
2. Compile PO files to JS
3. Load compiled translations for Babel plugin (non-Suspense)
4. Set up incremental extraction (dev mode)

**HMR** (dev mode):

- PO file changes → recompile → full reload
- Source file changes → incremental extraction → recompile

**Babel Integration** via Vite's `api.reactBabel`:

```typescript
babelConfig.plugins.push([
  '@idioma/core/babel',
  {
    mode: useSuspense ? 'suspense' : 'inlined',
    translations: loadedTranslations, // only for inlined mode
    idiomaDir: '/abs/path/to/idioma',
  },
]);
```

**Incremental Extraction** (`packages/core/src/bundler/incremental-extract.ts`):

- Debounced (200ms) to batch rapid changes
- File-only references (no line numbers to avoid noisy git diffs)
- Per-file extraction with reference-aware cleanup

#### Next.js Plugin (`packages/core/src/bundler/next.ts`)

- Custom Webpack plugin instead of Babel config approach
- Hooks: `beforeCompile`, `watchRun`
- No HMR (relies on Next.js refresh)
- Same Babel plugin, different integration point

#### Metro Plugin (`packages/core/src/bundler/metro.ts`)

Similar pattern for React Native.

---

### Key Conventions

- Message keys are content-addressable hashes (murmurhash of source text)
- ICU MessageFormat for plurals/selects: `{count, plural, one {# item} other {# items}}`
- Component interpolation uses named tags from JSX: `<Link>click here</Link>`
- PO files follow gettext format with ICU in msgstr

## Documentation

**Keep the README up to date.** When making changes that affect:

- Public API (new features, changed behavior, deprecations)
- Installation or setup steps
- CLI commands or options
- Configuration options
- Usage examples

Update the README.md accordingly to reflect these changes.
