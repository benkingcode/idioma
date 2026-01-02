'use client';

import { Trans } from '@/idiomi';
import React from 'react';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default function BlogPostPage({ params }: Props) {
  // Note: In a real app, we'd use use() hook for async params in client component
  // For this test fixture, we'll pass params through differently
  const { locale, slug } = React.use(params);

  return (
    <div data-testid="blog-post-page">
      <h1 data-testid="blog-post-title">
        <Trans>Blog Post</Trans>
      </h1>
      <p data-testid="blog-post-slug">Slug: {slug}</p>
      <p data-testid="blog-post-locale">Locale: {locale}</p>
    </div>
  );
}
