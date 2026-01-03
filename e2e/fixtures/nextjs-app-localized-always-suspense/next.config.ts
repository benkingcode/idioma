import { withIdiomi } from '@idiomi/core/next';
import type { NextConfig } from 'next';

export default withIdiomi()({
  // No i18n config - we handle routing manually via proxy
} satisfies NextConfig);
