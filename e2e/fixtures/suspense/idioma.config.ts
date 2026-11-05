import { defineConfig } from '@idioma/core';

export default defineConfig({
  idiomaDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es', 'ar'],
  useSuspense: true, // Enable Suspense mode for React 19+ lazy loading
});
