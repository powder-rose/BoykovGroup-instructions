import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createReadStream, statSync } from 'node:fs';

const accountDirectory = new URL('../public_html/account/', import.meta.url);
const legacyAssetDirectory = new URL('../public_html/assets/', import.meta.url);
const accountStyles = new Set([
  '/assets/index-generation-first-20260827-145204.css',
  '/assets/boykovdocs-design-foundation-20260828-115813.css',
]);

function serveAccountPages() {
  return {
    name: 'local-account-pages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/account') {
          res.writeHead(302, { Location: '/account/' });
          res.end();
          return;
        }

        let file;
        if (pathname === '/account/') {
          file = new URL('index.html', accountDirectory);
        } else if (/^\/account\/[a-zA-Z0-9_.-]+\.(?:js|css)$/u.test(pathname)) {
          file = new URL(pathname.slice('/account/'.length), accountDirectory);
        } else if (accountStyles.has(pathname)) {
          file = new URL(pathname.slice('/assets/'.length), legacyAssetDirectory);
        } else {
          next();
          return;
        }

        try {
          if (!statSync(file).isFile()) return next();
        } catch {
          return next();
        }

        const contentType = file.pathname.endsWith('.css')
          ? 'text/css'
          : file.pathname.endsWith('.js')
            ? 'text/javascript'
            : 'text/html';
        res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(file).on('error', next).pipe(res);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveAccountPages()],
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
