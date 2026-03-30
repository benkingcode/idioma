import { withIdiomi } from '@idiomi/core/next';
import type { NextConfig } from 'next';

export default withIdiomi()({
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
  },
} satisfies NextConfig);
