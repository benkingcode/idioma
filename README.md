# Idioma

**AI-first, compile-time i18n for React. Write in English, ship in every language.**

~800 bytes runtime. No manual keys. AI-powered translation.

## Features

- **Write natural JSX** — `<Trans>Hello {name}</Trans>`, not `t('greeting.hello', {name})`
- **Content-addressable keys** — Messages auto-generate deterministic hash keys
- **ICU MessageFormat** — Full support for plurals, selects, and complex logic
- **AI translation** — Context-aware translation with Claude or GPT
- **PO file format** — Works with Phrase, Lokalise, Crowdin, and any TMS
- **Type-safe output** — Generated TypeScript with full autocomplete
- **Instant switching** — All locales bundled by default, or lazy-load with Suspense
- **Vite plugin** — HMR for translations, zero config
- **Next.js plugin** — Works with App Router and Pages Router
- **React Server Components** — Native RSC support with async translations

## Quick Start

```bash
npm install @idioma/core @idioma/react
```

Add the Vite plugin:

```ts
// vite.config.ts
import { idioma } from '@idioma/core/bundler/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), idioma()],
});
```

Create a config file:

```ts
// idioma.config.ts
import { defineConfig } from '@idioma/core';

export default defineConfig({
  localeDir: './locales',
  outputDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
});
```

Set up the provider:

```tsx
// main.tsx
import { IdiomaProvider } from './src/idioma';

createRoot(document.getElementById('root')!).render(
  <IdiomaProvider locale="en">
    <App />
  </IdiomaProvider>,
);
```

Use it:

```tsx
import { Trans } from './src/idioma';

function Greeting({ name }) {
  return <Trans>Hello {name}!</Trans>;
}
```

## Next.js

Add the Next.js plugin to your config:

```js
// next.config.mjs
import { withIdioma } from '@idioma/core/next';

export default withIdioma({
  localeDir: './locales',
  outputDir: './src/idioma',
  defaultLocale: 'en',
})({
  // your other Next.js config
});
```

Add the Babel preset:

```js
// babel.config.js
module.exports = {
  presets: ['next/babel', '@idioma/core/babel-preset'],
};
```

Set up the provider in your root layout:

```tsx
// app/layout.tsx (App Router)
import { IdiomaProvider } from '@/idioma';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <IdiomaProvider locale="en">{children}</IdiomaProvider>
      </body>
    </html>
  );
}
```

Works with both App Router and Pages Router.

## React Server Components

For translations in React Server Components (RSC), use `createServerT`:

```tsx
// app/page.tsx (Server Component)
import { createServerT } from '@/idioma/server';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = createServerT(locale);

  return (
    <div>
      <h1>{await t('Welcome to our app')}</h1>
      <p>{await t('Hello {name}', { name: 'Ben' })}</p>
    </div>
  );
}
```

The `t` function supports:

```ts
// Source text (auto-hashed to key)
await t('Hello world!');

// With values
await t('Hello {name}', { name: 'Ben' });

// Key-only mode (like <Trans id="...">)
await t({ id: 'welcome' });
await t({ id: 'greeting', values: { name: 'Ben' } });

// With context (changes hash)
await t('Submit', { context: 'button' });
```

The client-side `useT` hook uses the same API, so you can share translation patterns between server and client components.

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
  Read our <a href="/terms">terms of service</a> and{' '}
  <a href="/privacy">privacy policy</a>
</Trans>
```

### Pluralization

```tsx
import { Plural, Trans } from './src/idioma';

<Trans>
  You have <Plural value={count} one="# item" other="# items" /> in your cart
</Trans>;
```

### Imperative usage with useT

```tsx
import { useT } from './src/idioma';

function SearchInput() {
  const t = useT();
  return <input placeholder={t('Search...')} />;
}

function Greeting({ name }) {
  const t = useT();
  return <span>{t('Hello {name}', { name })}</span>;
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
import { defineConfig } from '@idioma/core';

export default defineConfig({
  // Where PO files are stored
  localeDir: './locales',

  // Where compiled translations go
  outputDir: './src/idioma',

  // Source language
  defaultLocale: 'en',

  // Target languages
  locales: ['en', 'es', 'fr', 'de', 'ja'],

  // Enable Suspense-based lazy loading (React 19+)
  useSuspense: false,

  // Files to scan for messages
  sourcePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],

  // AI translation config
  ai: {
    provider: 'anthropic', // or 'openai'
    model: 'claude-sonnet-4-20250514',
    // Uses ANTHROPIC_API_KEY or OPENAI_API_KEY env var
  },
});
```

## Suspense Mode (React 19+)

For large apps, you can enable Suspense-based lazy loading to reduce bundle size. Instead of inlining all locales, translations load via dynamic imports per code-split chunk.

```ts
// idioma.config.ts
export default defineConfig({
  localeDir: './locales',
  outputDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
  useSuspense: true, // Enable lazy loading
});
```

Wrap your app with a Suspense boundary:

```tsx
import { IdiomaProvider } from './src/idioma';

<IdiomaProvider locale={locale}>
  <Suspense fallback={<Loading />}>
    <App />
  </Suspense>
</IdiomaProvider>;
```

**Trade-offs:**

|               | Default mode        | Suspense mode             |
| ------------- | ------------------- | ------------------------- |
| Bundle size   | All locales inlined | Dynamic imports per chunk |
| Locale switch | Instant             | Suspends until loaded     |
| React version | 18+                 | 19+ (uses `use` hook)     |

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

| Feature        | Idioma   | react-intl | i18next  | lingui   |
| -------------- | -------- | ---------- | -------- | -------- |
| Runtime size   | ~800B    | ~13KB      | ~40KB    | ~5KB     |
| Key management | Auto     | Manual     | Manual   | Auto     |
| Extraction     | Built-in | External   | External | Built-in |
| AI translation | Built-in | No         | No       | No       |
| Compile-time   | Yes      | No         | No       | Yes      |
| Lazy loading   | Opt-in   | Yes        | Yes      | Yes      |
| PO format      | Yes      | No         | No       | Yes      |

## Packages

- **@idioma/core** — Babel plugin, Vite plugin, Next.js plugin, CLI, PO compiler
- **@idioma/react** — Runtime components (~800 bytes gzipped)

## License

MIT
