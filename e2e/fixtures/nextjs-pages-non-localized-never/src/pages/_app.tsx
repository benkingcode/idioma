import { IdiomiProvider } from '@/idiomi/client';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const locale = (router.locale ?? 'en') as 'en' | 'es';

  return (
    <IdiomiProvider locale={locale}>
      <Component {...pageProps} />
    </IdiomiProvider>
  );
}
