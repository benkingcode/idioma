# Idioma

**Compile-time React i18n. Write in English, ship in every language.**

~800 bytes runtime. No async loading. No manual keys. AI-powered translation.

## Features

- **Write natural JSX** — `<Trans>Hello {name}</Trans>`, not `t('greeting.hello', {name})`
- **Content-addressable keys** — Messages auto-generate deterministic hash keys
- **ICU MessageFormat** — Full support for plurals, selects, and complex logic
- **AI translation** — Context-aware translation with Claude or GPT
- **PO file format** — Works with Phrase, Lokalise, Crowdin, and any TMS
- **Type-safe output** — Generated TypeScript with full autocomplete
- **Instant switching** — All locales bundled, no dynamic imports
- **Vite plugin** — HMR for translations, zero config

## Quick Start

```bash
npm install @idioma/core @idioma/react
```

Add the Vite plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { idioma } from '@idioma/core/bundler/vite'

export default defineConfig({
  plugins: [react(), idioma()]
})
```

Create a config file:

```ts
// idioma.config.ts
import { defineConfig } from '@idioma/core'

export default defineConfig({
  localeDir: './locales',
  outputDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr']
})
```

Set up the provider:

```tsx
// main.tsx
import { createIdiomaProvider, createUseLocale } from '@idioma/react'

export const IdiomaProvider = createIdiomaProvider()
export const useLocale = createUseLocale()

createRoot(document.getElementById('root')!).render(
  <IdiomaProvider defaultLocale="en">
    <App />
  </IdiomaProvider>
)
```

Use it:

```tsx
import { Trans } from '@idioma/react'

function Greeting({ name }) {
  return <Trans>Hello {name}!</Trans>
}
```

## Usage

### Basic translation

```tsx
<Trans>Welcome to our app</Trans>
```

### Variable interpolation

```tsx
<Trans>You have {count} new messages</Trans>
```

### Component interpolation

```tsx
<Trans>
  Read our <a href="/terms">terms of service</a> and <a href="/privacy">privacy policy</a>
</Trans>
```

### Pluralization

```tsx
import { Trans, Plural } from '@idioma/react'

<Trans>
  You have <Plural value={count} one="# item" other="# items" /> in your cart
</Trans>
```

### Imperative usage with useT

```tsx
import { useT } from '@idioma/react'

function SearchInput() {
  const t = useT()
  return <input placeholder={t`Search...`} />
}
```

## CLI Commands

```bash
# Extract messages from source files to PO
idioma extract

# Compile PO files to TypeScript
idioma compile

# AI-powered translation
idioma translate --locale es

# Validate translations
idioma check

# Show translation statistics
idioma stats
```

## Configuration

```ts
// idioma.config.ts
import { defineConfig } from '@idioma/core'

export default defineConfig({
  // Where PO files are stored
  localeDir: './locales',

  // Where compiled translations go
  outputDir: './src/idioma',

  // Source language
  defaultLocale: 'en',

  // Target languages
  locales: ['en', 'es', 'fr', 'de', 'ja'],

  // Files to scan for messages
  sourcePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],

  // AI translation config
  ai: {
    provider: 'anthropic', // or 'openai'
    model: 'claude-sonnet-4-20250514',
    // Uses ANTHROPIC_API_KEY or OPENAI_API_KEY env var
  }
})
```

## How It Works

**Development:**
```
<Trans>Hello {name}</Trans>
    ↓ runs as-is
React context provides locale, renders translated text
```

**Production build:**
```
<Trans>Hello {name}</Trans>
    ↓ Babel transforms to
<__Trans __t={__$idioma.a7Fk29} __a={{name}} />
```

The Babel plugin extracts messages during build, generates content-addressed keys, and transforms components to use the compiled translation object.

## Comparison

| Feature | Idioma | react-intl | i18next | lingui |
|---------|--------|------------|---------|--------|
| Runtime size | ~800B | ~13KB | ~40KB | ~5KB |
| Key management | Auto | Manual | Manual | Auto |
| Extraction | Built-in | External | External | Built-in |
| AI translation | Built-in | No | No | No |
| Compile-time | Yes | No | No | Yes |
| PO format | Yes | No | No | Yes |

## Packages

- **@idioma/core** — Babel plugin, Vite plugin, CLI, PO compiler
- **@idioma/react** — Runtime components (~800 bytes gzipped)

## License

MIT
