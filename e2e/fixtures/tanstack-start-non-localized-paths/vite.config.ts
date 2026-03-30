import idiomi from '@idiomi/core/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsConfigPaths(), tanstackStart(), idiomi(), react()],
  server: {
    hmr: {
      overlay: false, // Disable error overlay to prevent blocking E2E tests
    },
  },
});
