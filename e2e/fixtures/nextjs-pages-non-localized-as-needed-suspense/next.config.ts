import type { NextConfig } from 'next';

// For now, skip the Idiomi webpack plugin and just use standard Next.js
// Pages Router uses built-in i18n routing
export default {
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    localeDetection: false, // We handle detection ourselves
  },
} satisfies NextConfig;
