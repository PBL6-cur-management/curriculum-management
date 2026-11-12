import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Same-origin /api in development, as Caddy serves it in production, so the session cookie needs no CORS setup.
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
