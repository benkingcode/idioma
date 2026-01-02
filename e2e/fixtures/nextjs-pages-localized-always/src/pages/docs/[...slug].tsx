import { Navigation } from '@/components/Navigation';
import { Trans } from '@/idiomi';
import { LocaleHead } from '@/idiomi/client';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';

interface DocsPageProps {
  slugPath: string;
}

export default function DocsPage({ slugPath }: DocsPageProps) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <main data-testid="docs-page">
      <LocaleHead />
      <Navigation />
      <h1 data-testid="docs-title">
        <Trans>Documentation</Trans>
      </h1>
      <p data-testid="docs-path">Path: {slugPath}</p>
    </main>
  );
}

export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
  const slugs = [['getting-started'], ['guide', 'installation']];
  const paths: { params: { slug: string[] }; locale: string }[] = [];

  for (const locale of locales ?? ['en']) {
    for (const slug of slugs) {
      paths.push({ params: { slug }, locale });
    }
  }

  return {
    paths,
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps<DocsPageProps> = async ({
  params,
}) => {
  const slug = params?.slug as string[];
  return {
    props: {
      slugPath: slug.join('/'),
    },
  };
};
