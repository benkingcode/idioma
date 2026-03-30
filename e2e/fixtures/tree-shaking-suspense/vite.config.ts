import idiomi from '@idiomi/core/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), idiomi(), react()],
  build: {
    manifest: true,
  },
});
