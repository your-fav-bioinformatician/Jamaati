import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The FastAPI backend (app/main.py) has no CORS middleware, so in
// development the browser talks to it through this same-origin proxy:
// /api/next_q → http://127.0.0.1:8000/next_q. Override the target with
// JAMAATI_API_TARGET if the backend runs elsewhere.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.JAMAATI_API_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
