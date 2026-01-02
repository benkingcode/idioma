'use client';

import { IdiomiProvider, type Locale } from '@/idiomi';

interface ProvidersProps {
  locale: Locale;
  children: React.ReactNode;
}

export function Providers({ locale, children }: ProvidersProps) {
  return <IdiomiProvider locale={locale}>{children}</IdiomiProvider>;
}
