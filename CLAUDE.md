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

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run a single test file
pnpm test packages/core/src/babel/plugin.test.ts

# Type check all packages
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## Architecture

Idioma is a compile-time React i18n library. Translations are extracted, stored in PO files, and compiled to optimized JavaScript at build time.

### Packages

**@idioma/core** (`packages/core/`) - Build tools and CLI

- `babel/` - Babel plugin that transforms `<Trans>` components and extracts messages
- `bundler/` - Vite plugin that compiles PO files and injects Babel transforms
- `cli/` - CLI commands: `extract`, `compile`, `check`, `stats`, `translate`
- `compiler/` - Compiles PO files to JS/TS with typed exports
- `icu/` - ICU MessageFormat parser and compiler
- `po/` - PO file parser and merge utilities
- `keys/` - Message key generation (murmurhash-based)

**@idioma/react** (`packages/react/`) - Runtime components

- `Trans` component and `__Trans` (compiled output)
- `__useT` hook (compiled output consumes this)
- `IdiomaContext` and `IdiomaProvider` for locale state
- `interpolate` for placeholder/tag substitution

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
  localeDir: './locales',
  outputDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
});
```

### Key Conventions

- Message keys are content-addressable hashes (murmurhash of source text)
- ICU MessageFormat for plurals/selects: `{count, plural, one {# item} other {# items}}`
- Component interpolation uses numbered tags: `<0>bold</0> and <1>italic</1>`
- PO files follow gettext format with ICU in msgstr
