import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const radiceRepository = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  // Il proxy di sviluppo punta alla porta del server Fastify: PORT del .env alla radice.
  const env = loadEnv(mode, radiceRepository, '');
  const server = `http://127.0.0.1:${env['PORT'] || '3010'}`;

  return {
    plugins: [
      sveltekit({
        // SPA: nessun rendering lato server, Fastify serve index.html per ogni rotta (§15.1).
        adapter: adapter({ fallback: 'index.html' }),
        // CSP (§15.5): lo script di avvio che SvelteKit mette nell'HTML è autorizzato con il
        // suo hash in un <meta>. Il web server aggiunge le direttive che un <meta> non può
        // contenere (frame-ancestors). Niente da siti esterni, caratteri compresi.
        csp: {
          mode: 'hash',
          directives: {
            'default-src': ['self'],
            'script-src': ['self'],
            'style-src': ['self', 'unsafe-inline'],
            'img-src': ['self', 'data:', 'blob:'],
            'font-src': ['self'],
            'connect-src': ['self'],
            'object-src': ['none'],
            'base-uri': ['self'],
            'form-action': ['self'],
          },
        },
      }),
    ],
    build: {
      // I caratteri restano file a parte, mai incorporati come data: nel CSS: così la CSP
      // può tenere font-src 'self'.
      assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
    server: {
      port: 5173,
      // In sviluppo le chiamate al backend passano dal server di Vite.
      proxy: {
        '/api': server,
        '/socket.io': { target: server, ws: true },
      },
    },
  };
});
