import idiomi from '@idiomi/core/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idiomi(), react()],
});
