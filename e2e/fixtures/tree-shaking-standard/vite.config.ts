import idioma from '@idioma/core/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), idioma(), react()],
  build: {
    manifest: true,
  },
});
