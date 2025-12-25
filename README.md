# Idioma

**AI-first, compile-time i18n for React. Write in English, ship in every language.**

~800 bytes runtime. Automatic key generation. AI-powered translation that understands your codebase and key context.

## Features

- **Write natural JSX** — `<Trans>Hello {name}</Trans>`, not `t('greeting.hello', {name})`
- **Content-addressable keys** — Messages auto-generate deterministic hash keys
- **ICU MessageFormat** — Full support for plurals, selects, and complex logic
- **AI translation** — Automatic context generation from source code + translation with Claude or GPT
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

// With values (2nd arg)
await t('Hello {name}', { name: 'Ben' });

// With context (3rd arg - changes hash)
await t('Submit', undefined, { context: 'button' });
await t('Hello {name}', { name: 'Ben' }, { context: 'greeting' });

// Key-only mode (like <Trans id="...">)
await t({ id: 'welcome' });
await t({ id: 'greeting', values: { name: 'Ben' } });
await t({ id: 'submit', context: 'modal' }); // context for translator reference
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

### Key-only mode

Use explicit keys instead of source text:

```tsx
<Trans id="welcome.hero" />
<Trans id="greeting" values={{ name: 'Ben' }} />
<Trans id="cart.items" values={{ count: 3 }} components={[<strong />]} />
```

### Context

Add translator context that affects key generation (same text, different context = different key):

```tsx
<Trans context="button">Submit</Trans>
<Trans context="form.title">Submit</Trans>
```

### Pluralization

```tsx
import { Plural, Trans } from './src/idioma';

<Trans>
  You have <Plural value={count} one="# item" other="# items" /> in your cart
</Trans>;
```

The `#` placeholder is replaced with the numeric value. Full plural forms for different languages:

```tsx
<Plural
  value={count}
  zero="No items" // 0 items (some languages)
  one="# item" // 1 item
  two="# items" // 2 items (Arabic, Welsh)
  few="# items" // 2-4 items (Slavic languages)
  many="# items" // 5+ items (Slavic, Arabic)
  other="# items" // Required fallback
/>
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

  // With values (2nd arg)
  const greeting = t('Hello {name}', { name });

  // With context (3rd arg - changes hash)
  const submitLabel = t('Submit', undefined, { context: 'button' });

  // With both values and context
  const message = t('Welcome {user}', { user: name }, { context: 'header' });

  return <span>{greeting}</span>;
}
```

### Pluralization with useT

Use the `plural()` function for pluralization in imperative code:

```tsx
import { plural, useT } from './src/idioma';

function CartSummary({ count }: { count: number }) {
  const t = useT();
  return (
    <p>{t(`You have ${plural(count, { one: '# item', other: '# items' })}`)}</p>
  );
}
```

### useLocale

Get the current locale:

```tsx
import { useLocale } from './src/idioma';

function LanguageSwitcher() {
  const locale = useLocale();
  return <span>Current: {locale}</span>;
}
```

### Namespaces

Organize translations into namespaces for large apps:

```tsx
// In components
<Trans ns="marketing">Welcome to our platform</Trans>;

// With useT
const t = useT();
t('Subscribe now', undefined, { ns: 'marketing' });
```

## CLI Commands

Run via npx or your package manager:

```bash
npx idioma <command>
pnpm idioma <command>
```

### extract

Extract messages from source files to PO:

```bash
idioma extract           # Extract all messages
idioma extract --clean   # Remove unused messages
idioma extract --watch   # Watch for changes
```

### compile

Compile PO files to TypeScript:

```bash
idioma compile
```

### translate

AI-powered translation (requires `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`):

```bash
idioma translate es                    # Translate missing messages to Spanish
idioma translate es --force            # Retranslate all messages
idioma translate es --dry-run          # Preview without saving
idioma translate es --provider openai  # Use OpenAI instead of Anthropic
idioma translate es --no-auto-context  # Skip automatic context generation
```

**Auto-context generation:** Before translating, Idioma reads your source files and uses AI to generate helpful context for each message (e.g., "Button label in checkout form"). This context is saved to the PO file and helps the translation AI produce more accurate results.

**Guidelines:** Configure `ai.guidelines` to describe your app's tone, audience, and style. These guidelines are sent to the AI during both context generation and translation, ensuring consistent results across your entire app.

```po
#. [AI Context]: Button label shown when user confirms their order
#: src/components/Checkout.tsx:42
msgid "Confirm"
msgstr "Confirmar"
```

Context is generated per-file for token efficiency. Messages that already have context (from `<Trans context="...">` or previous AI generation) are skipped.

### check

Validate translation completeness:

```bash
idioma check              # Check all locales
idioma check --locale es  # Check specific locale
```

Exits with code 1 if translations are incomplete.

### stats

Show translation statistics:

```bash
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

  // Files to scan for messages (default: ['**/*.tsx', '**/*.jsx', '**/*.ts', '**/*.js'])
  sourcePatterns: ['src/**/*.tsx', 'src/**/*.jsx'],

  // AI translation config
  ai: {
    provider: 'anthropic', // or 'openai'
    model: 'claude-sonnet-4-20250514', // default: claude-sonnet-4-20250514 (Anthropic) or gpt-4o (OpenAI)
    // Uses ANTHROPIC_API_KEY or OPENAI_API_KEY env var

    // Project-specific guidelines for AI translation
    guidelines: `This is a children's educational game for ages 4-8.
Use simple, friendly language. Avoid complex vocabulary.`,
  },
});
```

## PO File Format

Idioma uses the standard [gettext PO format](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html) with ICU MessageFormat in translations:

```po
# locales/es.po

# Simple message
msgid "Hello {name}"
msgstr "Hola {name}"

# With explicit context (from <Trans context="button">)
msgctxt "button"
msgid "Submit"
msgstr "Enviar"

# With AI-generated context (from idioma translate)
#. [AI Context]: Error message when payment fails at checkout
#: src/components/Checkout.tsx:87
msgid "Payment failed"
msgstr "El pago falló"

# Pluralization (ICU format)
msgid "{count, plural, one {# item} other {# items}}"
msgstr "{count, plural, one {# artículo} other {# artículos}}"

# Component interpolation
msgid "Read our <0>terms</0> and <1>privacy policy</1>"
msgstr "Lee nuestros <0>términos</0> y <1>política de privacidad</1>"
```

PO files work with translation management systems like Phrase, Lokalise, and Crowdin.

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

## How Keys Work

Idioma uses content-addressable keys—the message text itself determines the key:

1. **Murmurhash3** generates a 32-bit hash from the source message
2. **Base62 encoding** (0-9, A-Z, a-z) produces compact 8-character keys
3. Keys are **deterministic**: same input always produces the same key

```
"Hello {name}" → murmurhash3 → base62 → "a7Fk29xQ"
```

The `context` prop creates different keys for identical text:

```tsx
<Trans>Submit</Trans>                        // → "xK9mP2nL"
<Trans context="button">Submit</Trans>       // → "r4Yt8wQz" (different key)
```

This enables translators to provide different translations for the same source text based on context.

## Missing Translations

When a translation is missing, Idioma falls back to the source text. This ensures your app always renders something meaningful, even for incomplete translations.

Use `idioma check` to identify missing translations before deployment.

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
