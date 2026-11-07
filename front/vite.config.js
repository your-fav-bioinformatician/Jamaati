import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// API base URL: src/api/client.js uses VITE_API_BASE (on Railway, the backend
// service's URL). Vite inlines it at build time, so it must be set when
// `npm run build` runs. The backend allows the frontend's origin through its
// CORS middleware (CORS_ORIGINS in app/config.py).
//
// When VITE_API_BASE is unset (local development), the client calls /api and
// the dev/preview servers proxy it to a local backend:
// /api/next_q → http://127.0.0.1:8000/next_q. Override the target with
// JAMAATI_API_TARGET, in the shell or a front/.env file.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

  const proxy = {
    '/api': {
      target: env.JAMAATI_API_TARGET || 'http://127.0.0.1:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  };

  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  };
});
