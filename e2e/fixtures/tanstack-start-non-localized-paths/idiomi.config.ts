import { anthropic } from '@ai-sdk/anthropic';
import { defineConfig } from '@idiomi/core';

export default defineConfig({
  idiomiDir: './src/idiomi',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  useSuspense: false,
  routing: {
    localizedPaths: false, // NO route translation, just prefix
    metadataBase: 'http://localhost:5180',
    prefixStrategy: 'as-needed',
  },
  ai: {
    model: anthropic('claude-haiku-4-5'),
  },
});
