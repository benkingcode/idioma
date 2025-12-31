/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  defaultLocale,
  detectLocale,
  IdiomiProvider,
  locales,
} from '../idiomi';
import type { Locale } from '../idiomi';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TanStack Start - Localized Paths' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Extract locale from URL path, fall back to detection (cookie/header)
  const urlLocale = (locales as readonly string[]).find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
  ) as Locale | undefined;
  const locale = urlLocale ?? detectLocale();

  return (
    <IdiomiProvider locale={locale}>
      <RootDocument>
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
          <Outlet />
        </div>
      </RootDocument>
    </IdiomiProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
