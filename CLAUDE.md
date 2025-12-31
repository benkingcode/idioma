# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Greenfield Project

**This is a greenfield project with no users yet.** Breaking changes are acceptable—don't waste time on backward compatibility, migration paths, or deprecation notices. Just make the API right.

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

## E2E Test Fixtures

The `e2e/fixtures/` directory contains test apps for different framework configurations:

| Fixture                              | Port | Framework           | Features                      |
| ------------------------------------ | ---- | ------------------- | ----------------------------- |
| `tanstack-localized-paths`           | 5175 | TanStack Router SPA | Localized paths (`/es/sobre`) |
| `tanstack-non-localized-paths`       | 5176 | TanStack Router SPA | Prefix-only (`/es/about`)     |
| `tanstack-start-localized-paths`     | 5179 | TanStack Start SSR  | Localized paths + SSR         |
| `tanstack-start-non-localized-paths` | 5180 | TanStack Start SSR  | Prefix-only + SSR             |

**TanStack Start SSR fixtures** test server-side `Accept-Language` header detection, cookie persistence across full-page navigation, and SSR hydration. Key differences from SPA fixtures:

- Use `tanstackStart()` Vite plugin instead of standard Vite React
- Root route (`__root.tsx`) renders full HTML document (`<html>`, `<head>`, `<body>`)
- Server entry (`src/server.ts`) uses `handleLocale` for locale detection before routing
- Compiler auto-generates `handleLocale` from `@idiomi/tanstack-react/server`
- No `localeLoader` in `beforeLoad` — server entry handles locale detection
- Navigation uses anchor tags with `href` (not TanStack's `navigate()`) for full-page reloads

**Running specific fixtures:**

```bash
cd e2e && npx playwright test --project=tanstack-start-localized-paths-shared
```

## Developing the Library

**When modifying `@idiomi/core` or `@idiomi/react`**, you must rebuild for changes to be visible to:

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

Idiomi is a compile-time React i18n library. Translations are extracted, stored in PO files, and compiled to optimized JavaScript at build time.

### Packages

**@idiomi/core** (`packages/core/`) - Build tools and CLI

- `babel/` - Babel plugin that transforms `<Trans>` components and extracts messages
- `bundler/` - Vite, Next.js, and Metro plugins for build integration
- `cli/` - CLI commands: `extract`, `compile`, `check`, `stats`, `translate`
- `compiler/` - Compiles PO files to JS/TS with typed exports
- `icu/` - ICU MessageFormat parser and compiler
- `po/` - PO file parser and merge utilities
- `keys/` - Message key generation (murmurhash-based)
- `ai/` - AI translation: context generation from source code, unified provider via Vercel AI SDK
- `locale/` - Locale matching utilities using `@formatjs/intl-localematcher` for BCP 47-compliant matching
- `routes/` - Route extraction and compilation for localized paths
- `framework.ts` - Framework detection utility (next-app, next-pages, tanstack, tanstack-start)

**@idiomi/react** (`packages/react/`) - Runtime components

- `Trans` component and `createTrans` factory (compiled output uses `__Trans`)
- `useT` hook and `createUseT` factory (compiled output uses `__useT`)
- `IdiomiContext` and `IdiomiProvider` for locale state
- `interpolate` for placeholder/tag substitution
- `getLocaleHead` - Pure function for generating hreflang link data (no hooks)
- `runtime-suspense/` - Suspense-based lazy loading (React 19+)
- `server/` - Server-side rendering utilities

**@idiomi/next** (`packages/next/`) - Next.js integration

- `middleware.ts` - `createIdiomiMiddleware()` and `createMiddlewareFactory()` for locale detection and URL rewriting
- `link.tsx` - `createLink()` factory for localized Link component, `resolveLocalizedHref()` for URL resolution with prefix strategy (App Router)
- `LocaleHead.tsx` - `createLocaleHead()` factory for SEO hreflang tags (App Router)
- `server/` - `setLocale()` for cookies
- `pages/` - Pages Router support with `createLink()`, `createLocaleHead()`, and `useLocalizedPath`

**@idiomi/tanstack-react** (`packages/tanstack-react/`) - TanStack Router/Start integration for React

- `client.ts` (main package export) - Client-safe factories for both SPA and SSR:
  - `createLocaleLoader()` - Creates `localeLoader` for `beforeLoad` and `detectLocale()` for manual detection
  - `createUrlHandler()` - Creates `delocalizeUrl` and `localizeUrl` for URL transformation (handles both localized paths and prefix-only)
- `server.ts` (exported via `/server` subpath) - Server-only factories for TanStack Start SSR:
  - `createLocaleDetector()` - SSR-aware locale detection using Accept-Language header
  - `createRequestHandler()` - Server entry middleware returning `{ locale, redirectResponse?, localizedCtx }`
- `internal/helpers.ts` - Shared utilities (cookie parsing, locale extraction, URL manipulation)
- `hooks.ts` - `useLocale()`, `useLocalizedPath()`, `useLocalizedHref()`
- `link.ts` - `resolveLocalizedHref()`, `resolveLocalizedPath()` utilities for URL resolution (TanStack uses native `<Link>` from `@tanstack/react-router`)
- `LocaleHead.tsx` - `createLocaleHead()` factory for SEO hreflang tags (accepts `reverseRoutes` for localized URL → canonical path conversion)

**TanStack SPA vs SSR separation**: The compiler automatically detects whether a project uses TanStack Start (SSR) or TanStack Router (SPA) based on `@tanstack/react-start` in dependencies:

- **TanStack Router (SPA)**: Uses `localeLoader` in `beforeLoad` for client-side locale detection and redirects
- **TanStack Start (SSR)**: Uses `handleLocale` in `src/server.ts` for server-level locale handling

**TanStack Start SSR**: The `/server` subpath exports server entry helpers:

1. `createRequestHandler(config)` - Factory that creates `handleLocale(ctx)` returning `{ locale, redirectResponse?, localizedCtx }`
2. `createLocaleDetector(config)` - Factory for SSR-aware `detectLocale()` using Accept-Language header
3. Uses `@idiomi/core/locale`'s `matchLocale()` for BCP 47-compliant language matching
4. `localeParamName` config option (default: `'locale'`) for runtime route matching via `router.matchRoute()`

**Server entry pattern** (`src/server.ts`):

```typescript
import {
  createStartHandler,
  defaultStreamHandler,
  defineHandlerCallback,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import { handleLocale } from './idiomi/server';

const customHandler = defineHandlerCallback(async (ctx) => {
  const { locale, redirectResponse, localizedCtx } = handleLocale(ctx);
  if (redirectResponse) return redirectResponse;
  // Custom logic here with locale
  return defaultStreamHandler(localizedCtx);
});

export default createServerEntry({ fetch: createStartHandler(customHandler) });
```

**TanStack Link strategy**: Unlike Next.js which uses Idiomi's custom `Link` wrapper, TanStack uses URL rewriting via `createRouter({ rewrite: { input, output } })`. Users write `<Link to="/{-$locale}/about" params={{}}>` with TanStack's native Link and the `localizeUrl` function handles path translation and prefix stripping for display.

**TanStack URL rewriting vs redirects**: Important architectural distinction:

- `rewrite.input` (`delocalizeUrl`): Transforms URL for **route matching** (internal). Does NOT change browser URL.
- `rewrite.output` (`localizeUrl`): Transforms URL for **link generation** (display). Does NOT change browser URL.
- `localeLoader` (`beforeLoad`): Throws actual **redirects** to change browser URL. Handles prefix strategy enforcement.

For cookie-based locale detection to work correctly:

1. `delocalizeUrl` returns unprefixed URLs unchanged (e.g., `/` stays `/`)
2. TanStack's `{-$locale}` optional segment matches the route
3. `localeLoader` detects locale from cookie, throws redirect to add prefix if needed
4. Browser URL changes to prefixed version (e.g., `/es/`)

### Configuration

Projects use `idiomi.config.ts`:

```typescript
import { defineConfig } from '@idiomi/core';

export default defineConfig({
  idiomiDir: './src/idiomi',
  // Optional: override PO file location if you have existing translations elsewhere
  // localesDir: './locales',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
  // Optional: enable routing integration (auto-generates Link, LocaleHead, createMiddleware)
  routing: {
    localizedPaths: true, // Enable translated URL paths (/es/sobre instead of /es/about)
    metadataBase: 'https://example.com', // Optional: for absolute hreflang URLs
    prefixStrategy: 'as-needed', // 'always' or 'as-needed' (default)
    localeParamName: 'locale', // Optional: name of locale param in routes (default: 'locale')
  },
});
```

### Folder Structure

The `idiomiDir` contains all Idiomi files:

```
src/idiomi/
├── .gitignore           # Auto-generated (ignores .generated/)
├── locales/             # PO files (git tracked)
│   ├── en.po
│   └── es.po
├── index.ts             # User import: Trans, useT, Link, LocaleHead, createMiddleware (when routing enabled)
├── server.ts            # Server-only exports for TanStack Start (handleLocale)
├── plain.ts             # User import: createT (non-React)
└── .generated/          # Internal files (gitignored)
    ├── translations.js
    ├── types.ts
    └── routes.js        # Only when routing.localizedPaths: true
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
// Before
const t = useT();
t('Hello {name}', { name: 'Ben' });

// After (Babel inlines translations as 2nd arg)
t('Hello {name}', { key123: { en: '...', es: '...' } }, { name: 'Ben' });
```

#### Suspense Mode (`mode: 'suspense'`) — For lazy loading (React 19+)

Uses dynamic imports with React 19's `use()` hook for lazy loading:

```tsx
// Babel injects at file level:
import { __TransSuspense } from '@idiomi/react/runtime-suspense';
const __$idiomiChunk = "src_components_Header";
const __$idiomiLoad = {
  en: () => import('./chunks/src_components_Header.en'),
  es: () => import('./chunks/src_components_Header.es')
};

// Then transforms:
<Trans>Hello</Trans>
// becomes:
<__TransSuspense __key="abc123" __chunk={__$idiomiChunk} __load={__$idiomiLoad} />
```

#### Prop Meanings (for transformed code)

- `__t`: Translation object `{ locale: translatedString | function }`
- `__a`: Arguments for placeholders `{ name: value }`
- `__c`: Component array for tag interpolation
- `__cn`: Component names for named tag matching (parallel to `__c`)
- `__ns`: Optional namespace

#### Import Detection

The plugin uses `idiomiDir` config to detect imports from the user's idiomi folder (not from `@idiomi/react` directly). This allows Babel to distinguish user Trans components from other libraries.

#### Binding Tracking

Tracks aliased imports and derived functions:

```tsx
import { createT, Trans as T, useT } from './idiomi';

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
- Uses `IdiomiContext` to get current locale
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

- Detects if 2nd arg is Babel-inlined translations (has shape `{ key: { locale: translation } }`)
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

- `extracted`: Idiomi-created message (can be auto-deleted when orphaned)
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
idiomi translate --dry-run --verbose
```

This creates a mock provider (`createDryRunProvider`) that returns "Dry run" for all translations. Useful for debugging guidelines and reviewing what context the AI receives.

### Route Extraction and Compilation

When `routing.localizedPaths: true` is set in config, Idiomi extracts and compiles route segments.

**Files**: `packages/core/src/routes/`

#### Route Extraction

- `extract-nextjs.ts` - Scans `app/` or `pages/` directories for route files
- `extract-tanstack.ts` - Parses `routeTree.gen.ts` (auto-generated by TanStack Router) using `.update()` definitions
- `types.ts` - `ExtractedRoute`, `Framework`, and framework-specific functions:
  - `isNextJsDynamicSegment()` - detects `[param]`, `[...slug]`, `[[...optional]]`
  - `isTanStackDynamicSegment()` - detects `$param`, `{$param}`, `{-$param}`, `$` (splat)
  - `isDynamicSegment(segment, framework)` - dispatches to the correct framework function
  - `getTranslatableSegments(segments, framework)` - filters out dynamic segments and route groups

**Extraction Flow**:

1. Detect framework from `package.json` (`next-app`, `next-pages`, or `tanstack`)
2. Call framework-specific extraction:
   - Next.js: Scan `app/` or `pages/` directories for route files
   - TanStack: Parse `routeTree.gen.ts` for `.update({ id, path })` definitions
3. Filter using framework-specific dynamic segment detection:
   - Next.js: `[slug]`, `[...slug]`, `[[...optional]]`
   - TanStack: `$slug`, `{$slug}`, `{-$slug}`, `$`
4. Filter out route groups `(marketing)` (both frameworks)
5. Add translatable segments to PO files with `route:` context prefix

```po
#: app/about/page.tsx
msgctxt "route:about"
msgid "xY3pQ7wR"
msgstr "sobre"
```

**Why segments, not full paths?**

- Translators see simple words: `blog`, `about`, `contact`
- No risk of breaking slashes or bracket syntax
- Dynamic segments never exposed to translation (Next.js `[slug]` or TanStack `$slug`)
- Path structure reconstructed at compile time using framework-native syntax

#### Route Compilation

`packages/core/src/routes/compile.ts`:

- `compileRoutes(routes, messages, locales, framework)` - Builds route maps from translated segments
- `generateRoutesModule()` - Generates JavaScript exports
- `generateRoutesTypes()` - Generates TypeScript types
- `ROUTE_CONTEXT_PREFIX = 'route:'` - Prefix for route context in PO files

**Compiled Output** (`.generated/routes.js`):

Next.js uses `[param]` syntax:

```javascript
export const routes = {
  en: { '/about': '/about', '/blog/[slug]': '/blog/[slug]' },
  es: { '/about': '/sobre', '/blog/[slug]': '/articulos/[slug]' },
};
```

TanStack uses `$param` syntax:

```javascript
export const routes = {
  en: { '/about': '/about', '/blog/$slug': '/blog/$slug' },
  es: { '/about': '/sobre', '/blog/$slug': '/articulos/$slug' },
};
```

The compiler reconstructs full paths by:

1. Splitting canonical path into segments
2. Looking up each segment translation
3. Preserving dynamic segments as-is (framework-native syntax)
4. Joining back with `/`

#### Auto-Generated Route-Aware Exports

When `routing` is configured in `idiomi.config.ts`, the compiler automatically generates pre-configured exports in `index.ts`:

```typescript
// Auto-generated in idiomi/index.ts when routing.localizedPaths: true

// Next.js only: Pre-configured Link and middleware
import { createLink, createLocaleHead } from '@idiomi/next'; // or @idiomi/next/pages
import { createMiddlewareFactory } from '@idiomi/next/middleware';
// TanStack Router SPA only: locale detection and URL rewriting via factories
// Factories encapsulate all helper logic - generated code is ~45 lines vs 270+ before
import { createLocaleLoader, createUrlHandler } from '@idiomi/tanstack-react';
import {
  defaultLocale,
  localeParamName,
  locales,
  prefixStrategy,
} from './.generated/config';
import { reverseRoutes, routes } from './.generated/routes';

// Pre-configured Link with routes, locale prefix strategy, and default locale
// NOTE: TanStack uses native <Link> from @tanstack/react-router, not this
export const Link = createLink({
  routes,
  defaultLocale,
  prefixStrategy,
});

// Pre-configured with locales, defaultLocale, routes, reverseRoutes, metadataBase, prefixStrategy
// reverseRoutes is used to convert localized URLs back to canonical paths for hreflang generation
export const LocaleHead = createLocaleHead({
  metadataBase: 'https://example.com',
  locales,
  defaultLocale,
  routes,
  reverseRoutes,
});

// Pre-configured middleware factory (Next.js and TanStack Start)
export const createMiddleware = createMiddlewareFactory({
  locales,
  defaultLocale,
  routes,
  reverseRoutes,
});

// Re-export pure function for programmatic use
export { getLocaleHead } from '@idiomi/react';

// TanStack Router SPA only: locale detection for beforeLoad
// localeLoader handles redirects based on prefixStrategy:
// - No locale in path + detected non-default → redirect to add prefix (/ → /es/)
// - No locale in path + detected is default → stay, return default locale
// - Default locale in path + as-needed → redirect to strip prefix (/en/about → /about)
// IMPORTANT: Uses location.searchStr (raw string like "?foo=bar"), NOT location.search
export const { localeLoader, detectLocale } = createLocaleLoader<Locale>({
  locales,
  defaultLocale,
  prefixStrategy,
  detection,
});

// For localized paths: URL rewrite functions
// delocalizeUrl: Transform localized path to canonical for route matching (/es/sobre → /es/about)
// localizeUrl: Transform canonical to localized for display (/es/about → /es/sobre)
// Use with createRouter({ rewrite: { input: delocalizeUrl, output: localizeUrl } })
// For non-localized paths (prefix-only), omit routes/reverseRoutes/routePatterns
export const { delocalizeUrl, localizeUrl } = createUrlHandler<Locale>({
  locales,
  defaultLocale,
  prefixStrategy,
  routes,
  reverseRoutes,
  routePatterns,
});

// Export localeParamName for runtime route matching
// Use with router.matchRoute() to check: localeParamName in (match.params ?? {})
export { localeParamName };
```

**Framework Detection** (`packages/core/src/framework.ts`):

The compiler detects the framework from `package.json` and directory structure:

- `next-app` - Next.js with App Router (has `app/` directory)
- `next-pages` - Next.js with Pages Router (has `pages/` but no `app/`)
- `tanstack` - TanStack Router (has `@tanstack/react-router` dependency)

This determines which packages to import from.

### Bundler Integration

#### Vite Plugin (`packages/core/src/bundler/vite.ts`)

**Lifecycle**: `configResolved → buildStart → handleHotUpdate (dev only)`

**buildStart**:

1. Load `idiomi.config.ts`
2. Compile PO files to JS
3. Load compiled translations for Babel plugin (non-Suspense)
4. Set up incremental extraction (dev mode)

**HMR** (dev mode):

- PO file changes → recompile → full reload
- Source file changes → incremental extraction → recompile

**Babel Integration** via Vite's `api.reactBabel`:

```typescript
babelConfig.plugins.push([
  '@idiomi/core/babel',
  {
    mode: useSuspense ? 'suspense' : 'inlined',
    translations: loadedTranslations, // only for inlined mode
    idiomiDir: '/abs/path/to/idiomi',
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
