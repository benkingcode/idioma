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
- **Tree-shaken bundles** — Only translations for components on each page ship; opt into Suspense to load one locale at a time
- **Vite plugin** — HMR for translations, zero config
- **Next.js plugin** — Works with App Router and Pages Router
- **React Native / Metro** — First-class React Native support with Metro bundler
- **React Server Components** — Native RSC support with async translations
- **Plain JS support** — `createT` for Zod schemas, error handling, and non-React code

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
  idiomaDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
});
```

This creates a folder structure:

```
src/idioma/
├── locales/      # PO files (git tracked)
├── index.ts      # Trans, useT, etc.
├── plain.ts      # createT (non-React)
└── .generated/   # Internal files (gitignored)
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
  idiomaDir: './src/idioma',
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

## React Native

Add the Metro configuration wrapper:

```js
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withIdioma } = require('@idioma/core/metro');

const config = getDefaultConfig(__dirname);

module.exports = withIdioma({
  idiomaDir: './src/idioma',
  defaultLocale: 'en',
})(config);
```

Add the Babel preset:

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [['@idioma/core/babel', { mode: 'production' }]],
};
```

Set up the provider in your app root:

```tsx
// App.tsx
import { IdiomaProvider } from './src/idioma';

export default function App() {
  return (
    <IdiomaProvider locale="en">
      <Main />
    </IdiomaProvider>
  );
}
```

Use translations in your components:

```tsx
import { Text, View } from 'react-native';
import { Trans, useT } from './src/idioma';

function Greeting({ name }) {
  const t = useT();
  return (
    <View>
      <Text>
        <Trans>Hello {name}!</Trans>
      </Text>
      <Text>{t('Welcome to the app')}</Text>
    </View>
  );
}
```

The Metro plugin automatically compiles translations on startup and watches for PO file changes during development.

## React Server Components

For translations in React Server Components (RSC), use `createT` from the plain module:

```tsx
// app/page.tsx (Server Component)
import { createT } from '@/idioma/plain';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = createT(locale);

  return (
    <div>
      <h1>{t('Welcome to our app')}</h1>
      <p>{t('Hello {name}', { name: 'Ben' })}</p>
    </div>
  );
}
```

The `t` function is synchronous and supports:

```ts
// Source text (auto-hashed to key)
t('Hello world!');

// With values (2nd arg)
t('Hello {name}', { name: 'Ben' });

// Key-only mode (like <Trans id="...">)
t({ id: 'welcome' });
t({ id: 'greeting', values: { name: 'Ben' } });
```

The client-side `useT` hook uses the same API, so you can share translation patterns between server and client components.

## Plain JavaScript (Outside React)

For translations in utility functions, validation schemas, error messages, or any code outside React components, use `createT`:

```typescript
// utils/validation.ts
import { createT } from '@/idioma/plain';

export function createUserSchema(locale: string) {
  const t = createT(locale);

  return z.object({
    email: z.string().email(t('Invalid email address')),
    password: z
      .string()
      .min(8, t('Password must be at least {min} characters', { min: 8 })),
  });
}

// Usage
const schema = createUserSchema('es');
schema.parse(formData); // Errors in Spanish
```

Works great for:

- **Zod/Yup schemas** — Localized validation messages
- **Error handling** — Translated error classes
- **Utility functions** — Any non-React code that needs i18n
- **Constants** — Lazy-evaluated translated labels

```typescript
// Custom error class
import { createT } from '@/idioma/plain';

export class AppError extends Error {
  constructor(code: string, locale: string, values?: Record<string, unknown>) {
    const t = createT(locale);
    super(t({ id: `errors.${code}`, values }));
    this.name = 'AppError';
  }
}

// API response helper
export function formatApiError(code: string, locale: string) {
  const t = createT(locale);
  return { success: false, message: t(`error.${code}`) };
}
```

**Bundle splitting:** In production, Babel inlines translations at each call site. Static strings (`t('literal')`) get optimal tree-shaking. Dynamic strings (`t(variable)`) trigger an automatic translations import for runtime lookup—Babel injects this only in files that need it.

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

Use the `plural()` function inside `<Trans>` or `t()` for pluralization:

```tsx
import { plural, Trans } from './src/idioma';

// In Trans component
<Trans>
  You have {plural(count, { one: '# item', other: '# items' })} in your cart
</Trans>;

// In t() template literal
const t = useT();
t(`You have ${plural(count, { one: '# item', other: '# items' })} in cart`);
```

The `#` placeholder is replaced with the numeric value. Both usages compile to ICU MessageFormat:

```
You have {count, plural, one {# item} other {# items}} in cart
```

Full plural forms for different languages:

```tsx
plural(count, {
  zero: 'No items', // 0 items (some languages)
  one: '# item', // 1 item
  two: '# items', // 2 items (Arabic, Welsh)
  few: '# items', // 2-4 items (Slavic languages)
  many: '# items', // 5+ items (Slavic, Arabic)
  other: '# items', // Required fallback
});
```

### Selection

Use the `select()` function for exact value matching (gender, status, categories):

```tsx
import { select, Trans } from './src/idioma';

// In Trans component
<Trans>
  {select(gender, { male: 'He', female: 'She', other: 'They' })} liked your post
</Trans>;

// In t() template literal
const t = useT();
t(
  `${select(status, { pending: 'Waiting', approved: 'Accepted', other: 'Unknown' })}`,
);
```

This compiles to ICU MessageFormat:

```
{gender, select, male {He} female {She} other {They}} liked your post
```

The `other` form is required as a fallback for unmatched values.

### Ordinal Numbers

Use `selectOrdinal()` for ordinal formatting (1st, 2nd, 3rd):

```tsx
import { selectOrdinal, Trans } from './src/idioma';

// In Trans component
<Trans>
  You finished in{' '}
  {selectOrdinal(place, { one: '#st', two: '#nd', few: '#rd', other: '#th' })}{' '}
  place
</Trans>;

// In t() template literal
const t = useT();
t(
  `Your ${selectOrdinal(attempt, { one: '#st', two: '#nd', few: '#rd', other: '#th' })} attempt`,
);
```

The `#` placeholder is replaced with the numeric value. This compiles to ICU MessageFormat:

```
You finished in {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place
```

Ordinal rules are locale-aware via CLDR. In English:

- `one` = 1, 21, 31... (ends in 1, not 11)
- `two` = 2, 22, 32... (ends in 2, not 12)
- `few` = 3, 23, 33... (ends in 3, not 13)
- `other` = 4, 5, 11, 12, 13, 14...

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
  // Base directory for all Idioma files
  // Generated files go in {idiomaDir}/, PO files in {idiomaDir}/locales/ by default
  idiomaDir: './src/idioma',

  // Optional: Override PO file location if you have existing translations elsewhere
  // localesDir: './locales',

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

## Bundle Optimization

Idioma automatically tree-shakes translations at the component level. Only the translations used by components on a given page are included in that page's bundle.

**How it works:**

1. The Babel plugin transforms each `<Trans>` to reference specific translation keys
2. Each source file's translations are compiled to a separate chunk
3. The bundler includes only the chunks imported by components on each route

This means a 10,000-message app doesn't ship 10,000 messages to every page—each page gets only what it needs.

**What gets bundled:**

- ✅ Translations for components rendered on the page
- ❌ Translations for components on other routes

By default, all locale variants for those keys are included (enabling instant locale switching). For apps where initial bundle size is critical, Suspense mode loads only the active locale.

## Suspense Mode (React 19+)

For apps where initial load size is critical, Suspense mode takes optimization further: instead of bundling all locale variants, it loads only the active locale via dynamic imports.

```ts
// idioma.config.ts
export default defineConfig({
  idiomaDir: './src/idioma',
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

|                      | Default mode           | Suspense mode          |
| -------------------- | ---------------------- | ---------------------- |
| Translations bundled | Per-page (tree-shaken) | Per-page (tree-shaken) |
| Locales bundled      | All locales            | Active locale only     |
| Locale switch        | Instant                | Suspends until loaded  |
| React version        | 18+                    | 19+ (uses `use` hook)  |

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

- **@idioma/core** — Babel plugin, Vite plugin, Next.js plugin, Metro plugin, CLI, PO compiler
- **@idioma/react** — Runtime components (~800 bytes gzipped)

## License

MIT
