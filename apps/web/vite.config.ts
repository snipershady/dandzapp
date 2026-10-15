import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const server = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [
    sveltekit({
      // SPA: nessun rendering lato server, Fastify serve index.html per ogni rotta (§15.1).
      adapter: adapter({ fallback: 'index.html' }),
    }),
  ],
  server: {
    port: 5173,
    // In sviluppo le chiamate al backend passano dal server di Vite.
    proxy: {
      '/api': server,
      '/socket.io': { target: server, ws: true },
    },
  },
});
