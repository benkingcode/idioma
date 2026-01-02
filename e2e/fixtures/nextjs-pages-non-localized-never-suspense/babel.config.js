import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  presets: [
    'next/babel',
    [
      '@idiomi/core/babel-preset',
      {
        idiomiDir: resolve(__dirname, './src/idiomi'),
        useSuspense: true,
      },
    ],
  ],
};
