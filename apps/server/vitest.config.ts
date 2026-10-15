import { defineConfig } from 'vitest/config';
import { ambienteTest } from './test/ambiente-test.ts';

// Impostate subito su process.env, così valgono anche per il setup globale (migrazioni)
// e non solo dentro i test: nulla deve mai toccare il database di sviluppo o di staging.
Object.assign(process.env, ambienteTest(), { APP_URL: 'http://localhost:5173' });

export default defineConfig({
  test: {
    globalSetup: ['./test/setup-globale.ts'],
    fileParallelism: false,
  },
});
