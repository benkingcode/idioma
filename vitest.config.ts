import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // @idioma/ai's unit tests run against core's source, as core's own do.
  // Without this they would import core's dist/, so a core change would
  // need a build before @idioma/ai's tests saw it.
  resolve: {
    alias: {
      '@idioma/core/internal': fileURLToPath(
        new URL('./packages/core/src/internal.ts', import.meta.url),
      ),
    },
  },
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
