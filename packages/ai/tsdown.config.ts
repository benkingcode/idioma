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
  target: 'node22',
  platform: 'node',
});
