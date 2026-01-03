import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function (api) {
  // Enable Babel caching
  api.cache(true);

  return {
    presets: ['next/babel'],
    overrides: [
      {
        // Only apply idiomi preset to non-proxy/middleware files
        exclude: [/proxy\.[jt]sx?$/, /middleware\.[jt]sx?$/],
        presets: [
          [
            '@idiomi/core/babel-preset',
            {
              idiomiDir: resolve(__dirname, './src/idiomi'),
            },
          ],
        ],
      },
    ],
  };
}
