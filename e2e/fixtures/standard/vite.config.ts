import idioma from '@idioma/core/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idioma(), react()],
});
