import { anthropic } from '@ai-sdk/anthropic';
import { defineConfig } from '@idiomi/core';

export default defineConfig({
  idiomiDir: './src/idiomi',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  useSuspense: false,
  routing: {
    localizedPaths: false,
    metadataBase: 'http://localhost:5189',
    prefixStrategy: 'never',
  },
  ai: {
    model: anthropic('claude-haiku-4-5'),
  },
});
