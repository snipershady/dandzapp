import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { ambienteTest } from '../server/test/ambiente-test.ts';

const porta = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${porta}`,
    locale: 'it-IT',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'telefono', use: { ...devices['Pixel 7'] } },
  ],
  // Build della SPA servita da Fastify, come in produzione, sul database di test.
  webServer: {
    command: [
      'npm run build',
      'npm run db:migra --workspace @dandzapp/server',
      'npm run avventura:importa --workspace @dandzapp/server -- ../../avventure/sessione-0',
      'node ../server/src/index.ts',
    ].join(' && '),
    url: `http://127.0.0.1:${porta}/api/salute`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...ambienteTest(),
      PORT: String(porta),
      // Molte registrazioni dallo stesso IP in pochi secondi: il limite è coperto da Vitest.
      LIMITE_TENTATIVI: 'false',
      APP_URL: `http://127.0.0.1:${porta}`,
      DATA_DIR: path.join(tmpdir(), 'dandzapp-e2e-dati'),
    },
  },
});
