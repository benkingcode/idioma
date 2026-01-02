import { spawn } from 'child_process';
import { createConnection } from 'net';

/**
 * Check if a server is running on a port
 */
export async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for a server to be ready
 */
export async function waitForServer(
  port: number,
  timeout = 120000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isPortOpen(port)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server on port ${port} did not start within ${timeout}ms`);
}

/**
 * Start a fixture server if not already running
 */
export async function ensureServer(config: {
  filter: string;
  port: number;
  timeout?: number;
  extraArgs?: string[];
}): Promise<void> {
  const { filter, port, timeout = 120000, extraArgs = [] } = config;

  // Check if already running
  if (await isPortOpen(port)) {
    console.log(`Server already running on port ${port}`);
    return;
  }

  console.log(`Starting ${filter} on port ${port}...`);

  // Start server in background (detached)
  const args = [
    '--filter',
    filter,
    'dev:fixture',
    '--port',
    String(port),
    ...extraArgs,
  ];

  const child = spawn('pnpm', args, {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  });

  // Unref so the parent process can exit
  child.unref();

  // Wait for server to be ready
  await waitForServer(port, timeout);
  console.log(`Server ${filter} ready on port ${port}`);
}
