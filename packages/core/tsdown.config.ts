import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  outDir: 'dist',
  format: 'esm',
  unbundle: true,
  dts: true,
  sourcemap: true,
  minify: true,
  clean: true,
  target: 'node18',
  platform: 'node',
  external: [
    // Peer dependencies & babel ecosystem
    /^@babel\//,
    'metro-config',
    'next',
    'vite',
    'webpack',
    // Regular dependencies (don't bundle)
    '@formatjs/icu-messageformat-parser',
    'chokidar',
    'citty',
    'consola',
    'fast-glob',
    'gettext-parser',
    'murmurhash-js',
    'pathe',
    'unplugin',
    // Optional AI providers
    '@anthropic-ai/sdk',
    'openai',
    'dotenv',
  ],
});
