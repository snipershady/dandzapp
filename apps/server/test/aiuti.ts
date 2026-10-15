import { caricaConfig, type Config } from '../src/config.ts';

/** Configurazione dei test: database `tavolo_test` (impostato in vitest.config.ts). */
export function configTest(modifiche: Partial<Config> = {}): Config {
  return { ...caricaConfig(), cartellaWeb: null, ...modifiche };
}
