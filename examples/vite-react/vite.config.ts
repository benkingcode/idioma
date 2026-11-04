import idioma from '@idioma/core/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // @idioma/react is linked from packages/react, whose own React is 18 (a dev
  // dependency). plugin-react 6 no longer dedupes React, so without this the
  // linked runtime would import React 18 beside the app's React 19.
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [
    idioma(), // Auto-loads from idioma.config.ts
    react(),
  ],
});
