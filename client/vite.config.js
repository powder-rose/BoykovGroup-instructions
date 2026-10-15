import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // слушать все сетевые интерфейсы (0.0.0.0), а не только localhost —
    // чтобы сайт был доступен и по локальному IP машины (например, с телефона
    // в той же сети): npm run dev, затем открыть http://<IP-машины>:5173
    host: '0.0.0.0',
    fs: {
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
});
