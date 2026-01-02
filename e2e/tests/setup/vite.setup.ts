import { test as setup } from '@playwright/test';
import { ensureServer } from '../../helpers/server';

setup('start standard fixture', async () => {
  await ensureServer({
    filter: 'e2e-fixture-standard',
    port: 5173,
  });
});

setup('start suspense fixture', async () => {
  await ensureServer({
    filter: 'e2e-fixture-suspense',
    port: 5174,
  });
});
