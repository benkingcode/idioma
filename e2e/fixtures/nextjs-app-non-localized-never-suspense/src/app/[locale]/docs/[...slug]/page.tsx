'use client';

import { Trans } from '@/idiomi';
import React from 'react';

interface Props {
  params: Promise<{ locale: string; slug: string[] }>;
}

export default function DocsPage({ params }: Props) {
  const { locale, slug } = React.use(params);

  return (
    <div data-testid="docs-page">
      <h1 data-testid="docs-title">
        <Trans>Documentation</Trans>
      </h1>
      <p data-testid="docs-slug">Path: /{slug.join('/')}</p>
      <p data-testid="docs-locale">Locale: {locale}</p>
    </div>
  );
}
