import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const fileEnv = new URL('../../.env', import.meta.url);
if (existsSync(fileEnv)) process.loadEnvFile(fileEnv);

export default defineConfig({
  test: {
    // I test usano sempre il database di test (DB_NAME_TEST), mai quello di sviluppo.
    env: {
      NODE_ENV: 'test',
      DB_NAME: process.env['DB_NAME_TEST'] ?? 'tavolo_test',
      LOG_LEVEL: 'silent',
    },
    fileParallelism: false,
  },
});
