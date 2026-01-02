import type { NextConfig } from 'next';

// For now, skip the Idiomi webpack plugin and just use standard Next.js
// Pages Router uses built-in i18n routing with native locale detection
export default {
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
  },
} satisfies NextConfig;
