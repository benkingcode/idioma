import { defineConfig } from '@idioma/core';

export default defineConfig({
  idiomaDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  useSuspense: true,
  ai: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  },
});
