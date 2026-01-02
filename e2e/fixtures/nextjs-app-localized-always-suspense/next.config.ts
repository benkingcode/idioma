import type { NextConfig } from 'next';

// For now, skip the Idiomi webpack plugin and just use standard Next.js
// We'll test the pattern matching logic in isolation
export default {
  // No i18n config - we handle routing manually via middleware
} satisfies NextConfig;
