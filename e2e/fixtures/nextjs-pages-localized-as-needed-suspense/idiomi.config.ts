import { anthropic } from '@ai-sdk/anthropic';
import { defineConfig } from '@idiomi/core';

export default defineConfig({
  idiomiDir: './src/idiomi',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  useSuspense: true,
  routing: {
    localizedPaths: true,
    metadataBase: 'http://localhost:5194',
    prefixStrategy: 'as-needed',
  },
  ai: {
    model: anthropic('claude-haiku-4-5'),
  },
});
