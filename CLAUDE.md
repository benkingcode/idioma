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
pnpm test packages/core/src/oxc/transform.test.ts
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
pnpm test packages/core/src/oxc/transform.test.ts

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

The E2E fixtures and examples import from the compiled `dist/` directories, not the source files directly. Forgetting to rebuild is a common source of confusion when changes "don't work". It also makes a red e2e run look like a flake: a test run against a `dist/` built before the fix fails, and passes once rebuilt.

### Toolchain and dependencies

- TypeScript 7 (`tsgo`) type-checks every package, and tsdown builds the declarations with it. Consumers use tsgo too, so a published `.d.ts` must type-check under it. tsdown stays on 0.23 (`^0.23.5`): its next minor needs TypeScript 7.1 for the tsgo path, and 7.1 is still in beta.
- Vitest runs two projects (`vitest.config.ts`): `node` for every test except `packages/react/**/*.test.tsx`, which run in `react` (jsdom). The React tests run on React 19. Nothing tests React 18, though the peer range allows it.
- `@idioma/react` is built with React Compiler 1.0 (`babel-plugin-react-compiler`).
- What the published packages import at runtime must be in their `dependencies` or `peerDependencies`. `packages/core/tests/integration/package-deps.test.ts` reads every runtime import in the three packages' `src/` and fails on one that is not. The 0.6.0 CLI crashed on a clean install because it imported `dotenv`, a devDependency. It now reads `.env` with Node's own `process.loadEnvFile()`. The same test fails if core or react import the AI SDK at all, type-only imports included (see AI Translation).

### Releasing

`scripts/version.sh <version>` bumps `@idioma/core`, `@idioma/react` and `@idioma/ai` together, commits and tags. Pushing the tag runs the Publish workflow, which publishes each package through `scripts/publish-if-new.sh`: it skips a version npm already has, so "Re-run failed jobs" after a failure publishes only what's missing. `@idioma/ai` publishes last. npm can't attach a trusted publisher (OIDC) to a package before it exists, so `@idioma/ai` is created by a hand publish first, and its trusted publisher is added on npmjs.com after that. Publish by hand with `pnpm publish`, never `npm publish`, which leaves `workspace:*` in the published manifest. Make the hand publish a placeholder prerelease (`0.8.0-next.0`, `--tag next`), not the real version: a new trusted publisher expires unless it publishes within 2 days, and `publish-if-new.sh` would skip a version that is already on npm.

## Architecture

Idioma is a compile-time React i18n library. Translations are extracted, stored in PO files, and compiled to optimized JavaScript at build time.

### Packages

**@idioma/core** (`packages/core/`) - Build tools and CLI

- `oxc/` - The Oxc transform: turns `<Trans>` and `t()` into compiled references, and extracts messages. No Babel
- `bundler/` - Vite and Metro plugins for build integration
- `cli/` - CLI commands: `extract`, `compile`, `check`, `stats`, `translate` (defined here, run by `@idioma/ai`)
- `compiler/` - Compiles PO files to JS/TS with typed exports
- `icu/` - ICU MessageFormat parser and compiler
- `po/` - PO file parser and merge utilities
- `keys/` - Message key generation (murmurhash-based)
- `internal.ts` - `@idioma/core/internal`: the helpers `@idioma/ai` uses. Not a public API

**@idioma/react** (`packages/react/`) - Runtime components

- `Trans` component and `createTrans` factory (compiled output uses `__Trans`)
- `useT` hook and `createUseT` factory (compiled output uses `__useT`)
- `IdiomaContext` and `IdiomaProvider` for locale state
- `interpolate` for placeholder/tag substitution
- `runtime-suspense/` - Suspense-based lazy loading (React 19+)
- `server/` - Server-side rendering utilities

**@idioma/ai** (`packages/ai/`) - AI translation, optional

- `translate.ts` - what `idioma translate` runs
- `context.ts`, `provider.ts` - context generation from source code, and translation, through the Vercel AI SDK
- `config.ts` - the `ai` block of `idioma.config.ts`: its types, `defineConfig`, and `readAiConfig`, which checks it

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
Source Code → Oxc Transform → PO Files → Compiler → JavaScript → Runtime
     ↓              ↓            ↓          ↓           ↓
  <Trans>       Extract      Translate   Compile    Render
  useT()        messages     (manual/AI)  to JS     message
```

**Two-Phase Compilation**: Extraction (code → PO) is separate from compilation (PO → JS). This enables manual editing and TMS (Translation Management System) integration.

### Transformations

The transform (`transformModule` in `packages/core/src/oxc/transform.ts`) parses with oxc-parser and edits the source with MagicString, so JSX stays JSX for the next plugin. There is no Babel in it (`packages/core/src/no-babel.test.ts`). It has two modes:

```typescript
mode?: 'inlined' | 'suspense'; // default: 'inlined'
```

#### Inlined Mode (`mode: 'inlined'`), the default

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

// After (the transform inlines translations as 2nd arg via __m marker)
t('Hello {name}', { __m: { en: '...', es: '...' } }, { name: 'Ben' });
```

```tsx
// Before (object form with explicit id)
t({ id: 'greeting', source: 'Hello {name}', values: { name: 'Ben' } });

// After (the transform normalizes to string form + inlines translations)
t('Hello {name}', { __m: { en: '...', es: '...' } }, { name: 'Ben' });
// Without source: t({ id: 'key' }) → t('key', { __m: { en: '...', es: '...' } })
```

A key-only `Trans` (no children) is inlined from the catalogue by its id; its `values` prop becomes `__a`, and the id is the `__source` fallback when the key has no translations:

```tsx
<Trans id="greeting" values={{ name }} />
// becomes:
<__Trans __t={{ en: 'Hello {name}', es: 'Hola {name}', __source: 'greeting' }} __a={{ name }} />
```

An id that is a conditional of string literals is split into one call or element per branch before anything else, so each branch is inlined and extracted like a literal id (`literalIdLeaves` in `oxc/transform.ts` decides what counts, for the transform and the CLI extractor alike):

```tsx
t({ id: live ? 'set.live' : 'set.past', values });
// becomes:
live ? t({ id: 'set.live', values }) : t({ id: 'set.past', values });
// then each branch is inlined as above
```

#### Calls that cannot be inlined fail the build

A call that is not inlined renders its id at runtime, and typecheck, compile and tests all stay green. So the plugin throws a code-frame error (always; there is no setting) for:

- `t({ ... })` whose id is not a string literal or a conditional of them, is missing, or comes from a spread
- `t({ id: '<catalogue key>' })` on a callee that is not a `t` from `useT()`/`createT()` in this file (a parameter, `props.t`). Only catalogue keys count, so `findUser({ id: 'abc' })` passes; suspense mode has no catalogue in the plugin and is not checked
- `<Trans id={...}>` whose id is not a string literal or a conditional of them
- `<Trans id>` that is not imported from the idioma folder

Dynamic string-form calls, `t(message)`, stay legal: `createT` looks them up at runtime. **Extraction is deliberately lenient where the plugin is strict:** the CLI and dev-mode extractors skip a non-literal id instead of failing, so a file being edited is not lost from the catalogue. The plugin is the gate; do not make one match the other.

A call that still reaches the runtime un-inlined (a file the transform never saw) warns once per id in development (`_warnNotInlined` in `packages/core/src/runtime/warn.ts`).

#### Suspense Mode (`mode: 'suspense'`), for lazy loading (React 19+)

Uses dynamic imports with React 19's `use()` hook for lazy loading:

```tsx
// The transform injects at file level:
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

The plugin uses `idiomaDir` config to detect imports from the user's idioma folder (not from `@idioma/react` directly). This lets the transform tell user Trans components apart from other libraries.

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

`packages/core/src/oxc/icu-calls.ts` converts helper functions to ICU format (`oxc/serialize.ts` does `<Trans>` children and template literals):

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

`packages/core/src/compiler/compile.ts` compiles a plural or select to a JavaScript function that returns a **template**: the branch it picks, with `#` filled in and every `{placeholder}` and `<Tag>` left in. The runtime renders that template as it renders a plain message, so tags become components and values are filled in after tags are read (a value never becomes a component):

```po
# PO entry:
msgstr "{count, plural, one {# item} other {# items}}. See <Link>{place}</Link>"
```

```javascript
// Compiled to (simplified): values are read by quoted name, never args.<name>
(args) => {
  return (
    ((v) => {
      const pr = new Intl.PluralRules('en');
      if (pr.select(v) === 'one') return String(v) + ' item';
      return String(v) + ' items';
    })(Number(args['count'])) + '. See <Link>{place}</Link>'
  );
};
```

ICU `number`, `date` and `time` arguments are formatted with `Intl`, with the options worked out at build time: the parser runs with `shouldParseSkeletons`, so a skeleton (`::currency/EUR`) arrives as Intl options, and the named styles (`integer`, `percent`; `short`, `medium`, `long`, `full`) map to FormatJS's intl-messageformat defaults (`NUMBER_STYLES`, `DATE_STYLES`, `TIME_STYLES` in `compile.ts`). A message with a format is compiled even without a plural, `#` is formatted as a number, date arguments are typed `Date | string | number`, and a style Intl can't format fails the compile.

`parseIcu` in `packages/core/src/icu/compiler.ts` is the one parser for the analyzer, the interpreter and the code generator. It keeps tags as literal text (`ignoreTag`), and it accepts dotted argument names such as `{user.name}` (which the serializer writes for member expressions and the formatjs parser rejects) by masking them before parsing. A message with a plural, select or selectordinal that does not parse **fails the compile**, naming the file and key; other text the parser rejects compiles as plain text. A PO file that does not parse also fails the compile (`loadLocaleCatalogs` only skips a missing file). In `vite build` both fail the build; the dev server logs them and keeps running.

Each locale's translation is analysed on its own text, so one locale can be a plural while another is a plain `{count} items`. A key's generated types (`MessageValues` variables, `MessageComponents` count) come from its first non-empty translation, reading the default locale first. An empty msgstr in another catalogue does not count.

#### Runtime ICU Helpers (source code only)

`packages/core/src/icu/index.ts` provides `plural()`, `select()`, and `selectOrdinal()` helpers that developers use in source code:

```tsx
<Trans>You have {plural(count, { one: '# item', other: '# items' })}</Trans>
```

These helpers are only used during extraction to serialize to ICU format. At runtime, the compiled JS functions handle the logic directly: the helper functions aren't called in production.

### Runtime Behavior

Since bundlers always use inlined or suspense mode, here's what actually runs.

**Locale fallback** is one picker, `_pickMessage` in `packages/core/src/runtime/message.ts`, shared by `__Trans`, `useT` and `createT`: the locale, its base locales one subtag at a time (`es-MX`, then `es`), the default locale, then the source text or id. It never picks another locale's text (#8). The runtime learns the default locale from the generated wrappers: `createIdiomaProvider({ defaultLocale })` in `idioma/index.ts` and `_createTFactory(locale, undefined, { defaultLocale })` in `idioma/plain.ts`.

#### Trans Component (`packages/react/src/Trans.tsx`)

**Inlined Mode** (the `__Trans` component):

- Receives pre-compiled translations via `__t` prop
- Uses `IdiomaContext` to get current locale
- Calls `renderMessage()` which handles:
  1. ICU functions (plurals/selects compiled to JS functions)
  2. Component tag interpolation (`<Link>text</Link>`)
  3. Value interpolation (`{name}`)

**Suspense Mode** (the `__TransSuspense` component, `packages/react/src/runtime-suspense/`):

- Uses React 19's `use()` hook
- Suspends while translations load via dynamic import
- Module-level cache prevents re-fetching

#### useT Hook (`packages/react/src/createUseT.tsx`)

**Inlined Mode**:

- Detects if 2nd arg is inlined translations (has `__m` marker: `{ __m: { locale: translation } }`)
- Uses inlined data when present
- Falls back to runtime lookup for dynamic strings (rare edge case)

**Suspense Mode** (`__useTSuspense`):

- Receives chunk ID and loader from the transform
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
- Updates references and comments for existing messages. `extractMessages` sorts the files it visits, so a message's references are in path order and a no-op extract writes the same bytes every run (fast-glob's own order is not stable). The first extract after this change reorders multi-file references once.
- Preserves existing translations
- Clean mode: removes orphaned messages **only if** they have `extracted` flag

**Incremental File Merge** (`mergeFileIntoCatalog`):
For dev mode incremental extraction:

1. Remove file path from references of messages the file no longer uses
2. Add file path to extracted message references (append only if absent, so reference order stays stable)
3. Find orphaned messages (no references)
4. Only remove if: has `extracted` flag AND no translations in other locales

This prevents auto-deletion of TMS-imported messages.

#### Writing (`writePoFile`)

- Skips the write when the catalog is unchanged. The existing file is parsed and re-serialized first, so formatting differences (line folding, header normalisation) do not count as changes. This keeps hand-formatted catalogs intact and stops Vite's `.po` handler from sending a full reload after a no-op extraction.
- Line folding follows `po.foldLength` in `idioma.config.ts`: the page width, wrapped as GNU `msgcat` wraps (gettext-parser 10; default 79, `0` disables folding). The Metro plugin takes `po` as a `withIdioma()` option.

#### Flag System

- `extracted`: Idioma-created message (can be auto-deleted when orphaned)
- No flag: Likely TMS-imported (preserved forever)

### AI Translation

AI translation is its own package, `@idioma/ai` (`packages/ai/src/`), with two features, both used only by `idioma translate`. Core has no AI code and names the AI SDK nowhere, in its code, its types or its manifest, so a project that doesn't translate installs neither. `package-deps.test.ts` enforces that, type-only imports included: a type import in a `.d.ts` broke `skipLibCheck: false` projects in 0.7.0.

How the two packages meet:

- **The command.** Core's CLI defines `idioma translate` and its arguments (`cli/commands/translate-command.ts`), then loads `@idioma/ai` from the project with `createRequire(<project>/package.json)`. It can't `import('@idioma/ai')`: pnpm links only a package's own dependencies next to it. Core's `package.json` doesn't name `@idioma/ai` either, so the packages don't form a build cycle. Without `@idioma/ai`, or with it but without `ai`, the command prints the install command and exits 1.
- **The contract.** `@idioma/ai`'s entry `satisfies` core's `AiPackage` interface, so the typecheck fails if they drift. It takes core's helpers from `@idioma/core/internal`, and peer-depends on the exact same core version.
- **The config.** Core keeps the `ai` block as written (`ai: z.unknown()`: zod would otherwise drop the key). `@idioma/ai` types it (`AiConfig`, `defineConfig`) and checks it when it translates (`readAiConfig`). The example app's tsconfig includes `idioma.config.ts`, so `pnpm typecheck` checks a real `anthropic()` model against `AiConfig`.
- **The tests.** `@idioma/ai`'s unit tests import `@idioma/core/internal` from core's source, through an alias in `vitest.config.ts`. Its `tsc --noEmit` reads core's built declarations, so build before you typecheck.
- **Flags.** citty reads `--no-x` as `x = false`, so a flag that turns something off is a default-true argument named `x` (`auto-context`, `mark-ai`), never one named `no-x`.

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
3. Load compiled translations for the transform (non-Suspense)
4. Set up incremental extraction (dev mode)

**HMR** (dev mode):

- PO file changes → the `hotUpdate` hook, once per environment (client, SSR) → one shared recompile → the catalogue before and after compared by key → only the modules that use a changed key are returned to Vite, and React Fast Refresh swaps them in place. The transform reports each module's keys (`messageKeys` on `TransformResult`, translated or not, namespaced with `catalogueKey()`), and the plugin keeps them by file. A PO write that changes no message updates nothing. Suspense mode, which does not inline translations, still reloads the page.
- Source file changes → incremental extraction → recompile (the resulting PO write then hot-updates the modules whose messages it added or changed)

**Transform**: its own `transform` hook with `order: 'pre'` and Rolldown hook filters (`filter.id`, `filter.code`), so it runs before `@vitejs/plugin-react` (6+, Oxc, React Compiler included) and before Vite's own JSX transform. It never uses `api.reactBabel`: plugin-react 6 has no Babel and never calls it (#20). Needs Vite 8+. When the app enables `experimental.nativeMagicString`, it edits Rolldown's native MagicString (`meta.magicString`).

**Incremental Extraction** (`packages/core/src/bundler/incremental-extract.ts`):

- Debounced (200ms) to batch rapid changes
- File-only references (no line numbers to avoid noisy git diffs)
- Per-file extraction with reference-aware cleanup

#### Metro Plugin (`packages/core/src/bundler/metro.ts`)

Same compile and watch pattern for React Native. `withIdioma` sets `transformer.babelTransformerPath` to `bundler/metro-transformer.ts`, which runs the Oxc transform and then the app's own transformer (Expo's or React Native's). Metro gives a transformer only the module, and its workers start after the config loads, so the upstream path and the options travel in environment variables (`IDIOMA_METRO_UPSTREAM_TRANSFORMER`, `IDIOMA_METRO_OPTIONS`). `getCacheKey` hashes the compiled catalogue, because the output inlines it.

It watches with chokidar 5, which has no globs. It watches the locales folder and the project root, and filters with `ignored` functions (`ignoreNonPoFiles`, `createSourceWatchIgnore`). Chokidar can call `ignored` without `stats`, so the extension filters only drop a path whose `stats` say it is a file, never a folder.

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
