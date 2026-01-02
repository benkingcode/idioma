import { Navigation } from '@/components/Navigation';
import { Trans } from '@/idiomi';
import { LocaleHead } from '@/idiomi/client';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';

interface BlogPostProps {
  slug: string;
}

export default function BlogPost({ slug }: BlogPostProps) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <main data-testid="blog-post-page">
      <LocaleHead />
      <Navigation />
      <h1 data-testid="blog-post-title">
        <Trans>Blog Post</Trans>: {slug}
      </h1>
      <p data-testid="blog-post-slug">Slug: {slug}</p>
    </main>
  );
}

export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
  const slugs = ['hello-world', 'second-post'];
  const paths: { params: { slug: string }; locale: string }[] = [];

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

export const getStaticProps: GetStaticProps<BlogPostProps> = async ({
  params,
}) => {
  return {
    props: {
      slug: params?.slug as string,
    },
  };
};
