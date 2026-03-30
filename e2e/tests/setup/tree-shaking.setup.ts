import { spawn } from 'child_process';
import { test as setup } from '@playwright/test';
import { isPortOpen, waitForServer } from '../../helpers/server';

async function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function ensureTreeShakingServer(filter: string, port: number) {
  if (await isPortOpen(port)) {
    console.log(`Server already running on port ${port}`);
    return;
  }

  console.log(`Building ${filter}...`);
  await runCommand('pnpm', ['--filter', filter, 'build:fixture']);

  console.log(`Starting preview server on port ${port}...`);
  const child = spawn(
    'pnpm',
    ['--filter', filter, 'preview', '--port', String(port)],
    {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
    },
  );
  child.unref();

  await waitForServer(port, 180000); // 3 min for build + start
  console.log(`Server ${filter} ready on port ${port}`);
}

setup('start tree-shaking-suspense', async () => {
  await ensureTreeShakingServer('e2e-fixture-tree-shaking-suspense', 5175);
});

setup('start tree-shaking-standard', async () => {
  await ensureTreeShakingServer('e2e-fixture-tree-shaking-standard', 5176);
});
