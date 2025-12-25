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
- `ai/` - AI translation: context generation from source code, provider abstraction (Anthropic/OpenAI)

**@idioma/react** (`packages/react/`) - Runtime components

- `Trans` component and `createTrans` factory (compiled output uses `__Trans`)
- `useT` hook and `createUseT` factory (compiled output uses `__useT`)
- `IdiomaContext` and `IdiomaProvider` for locale state
- `interpolate` for placeholder/tag substitution
- `runtime-suspense/` - Suspense-based lazy loading (React 19+)
- `server/` - Server-side rendering utilities

### Compilation Flow

1. **Development**: `<Trans>Hello {name}</Trans>` runs as-is with React context
2. **Extraction**: Babel plugin extracts messages to PO via `onExtract` callback
3. **Translation**: PO files edited manually or via `idioma translate` (AI-powered)
4. **Compilation**: PO → JS with typed exports (`translations.js`, `types.ts`)
5. **Production**: Babel transforms `<Trans>` → `<__Trans __t={...} __a={...} />`

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

### Key Conventions

- Message keys are content-addressable hashes (murmurhash of source text)
- ICU MessageFormat for plurals/selects: `{count, plural, one {# item} other {# items}}`
- Component interpolation uses numbered tags: `<0>bold</0> and <1>italic</1>`
- PO files follow gettext format with ICU in msgstr

## Documentation

**Keep the README up to date.** When making changes that affect:

- Public API (new features, changed behavior, deprecations)
- Installation or setup steps
- CLI commands or options
- Configuration options
- Usage examples

Update the README.md accordingly to reflect these changes.
