import { test as setup } from '@playwright/test';
import { ensureServer } from '../../helpers/server';

// Next.js Pages Router - Standard mode fixtures
setup('start nextjs-pages-localized-as-needed', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-localized-as-needed',
    port: 5186,
  });
});

setup('start nextjs-pages-localized-always', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-localized-always',
    port: 5187,
  });
});

setup('start nextjs-pages-non-localized-as-needed', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-non-localized-as-needed',
    port: 5188,
  });
});

setup('start nextjs-pages-non-localized-never', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-non-localized-never',
    port: 5189,
  });
});

// Next.js Pages Router - Suspense mode fixtures
setup('start nextjs-pages-localized-as-needed-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-localized-as-needed-suspense',
    port: 5194,
  });
});

setup('start nextjs-pages-localized-always-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-localized-always-suspense',
    port: 5195,
  });
});

setup('start nextjs-pages-non-localized-as-needed-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-non-localized-as-needed-suspense',
    port: 5196,
  });
});

setup('start nextjs-pages-non-localized-never-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-pages-non-localized-never-suspense',
    port: 5197,
  });
});
