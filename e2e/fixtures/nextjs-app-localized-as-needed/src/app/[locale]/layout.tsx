import { Navigation } from '@/components/Navigation';
import type { Locale } from '@/idiomi';
import { LocaleHead } from '@/idiomi/client';
import { headers } from 'next/headers';
import { Providers } from './providers';

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  // Cast string to Locale after extraction
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;

  // Get current pathname from headers
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';

  return (
    <html lang={locale}>
      <head>
        <LocaleHead pathname={pathname} locale={locale} />
      </head>
      <body>
        <Providers locale={locale}>
          <Navigation />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
