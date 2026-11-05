import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api calls are forwarded to the Express server, so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': process.env.API_URL || 'http://127.0.0.1:5000',
    },
  },
});
