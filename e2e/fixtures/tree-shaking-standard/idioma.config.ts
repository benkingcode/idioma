import { defineConfig } from '@idioma/core';

export default defineConfig({
  idiomaDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  useSuspense: false,
});
