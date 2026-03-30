import { anthropic } from '@ai-sdk/anthropic';
import { defineConfig } from '@idiomi/core';

export default defineConfig({
  idiomiDir: './src/idiomi',
  defaultLocale: 'en',
  locales: ['en', 'es', 'ar'],
  ai: {
    model: anthropic('claude-haiku-4-5'),
  },
});
