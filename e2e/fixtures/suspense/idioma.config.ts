export default {
  idiomaDir: './src/idioma',
  defaultLocale: 'en',
  locales: ['en', 'es', 'ar'],
  useSuspense: true, // Enable Suspense mode for React 19+ lazy loading
  ai: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  },
};
