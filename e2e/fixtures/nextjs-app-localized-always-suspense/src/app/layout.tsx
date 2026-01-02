import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next.js Localized Paths E2E Fixture',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
