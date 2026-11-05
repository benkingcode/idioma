import idioma from '@idioma/core/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // @idioma/react is linked from packages/react, which has its own React (a
  // dev dependency). plugin-react 6 no longer dedupes React, so without this
  // the linked runtime would load a second copy of React beside the app's.
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), idioma(), react()],
  build: {
    manifest: true,
  },
});
