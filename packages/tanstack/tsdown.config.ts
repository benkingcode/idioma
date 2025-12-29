import pluginBabel from '@rollup/plugin-babel';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
  ],
  outDir: 'dist',
  format: 'esm',
  unbundle: true,
  dts: true,
  sourcemap: true,
  minify: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  external: [
    'react',
    'react-dom',
    '@idiomi/core',
    '@idiomi/react',
    '@tanstack/react-router',
  ],

  // React Compiler via Babel plugin
  plugins: [
    pluginBabel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.tsx'],
      exclude: 'node_modules/**',
      presets: [
        ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
      ],
      plugins: ['babel-plugin-react-compiler'],
    }),
  ],
});
