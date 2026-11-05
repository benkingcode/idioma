import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
    // React component tests run in jsdom, everything else in Node.
    // (environmentMatchGlobs, which this used, was removed in Vitest 4.)
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['packages/**/*.test.{ts,tsx}'],
          exclude: ['packages/react/**/*.test.tsx', '**/node_modules/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'react',
          include: ['packages/react/**/*.test.tsx'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
