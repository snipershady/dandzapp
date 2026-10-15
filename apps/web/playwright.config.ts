import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const fileEnv = new URL('../../.env', import.meta.url);
if (existsSync(fileEnv)) process.loadEnvFile(fileEnv);

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
    command: 'npm run build && node ../server/src/index.ts',
    url: `http://127.0.0.1:${porta}/api/salute`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(porta),
      DB_NAME: process.env['DB_NAME_TEST'] ?? 'tavolo_test',
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
    },
  },
});
