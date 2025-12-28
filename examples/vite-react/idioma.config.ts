import { anthropic } from '@ai-sdk/anthropic';
import { defineConfig } from '@idioma/core';

export default defineConfig({
  idiomaDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  ai: {
    model: anthropic('claude-haiku-4-5'),
  },
});
