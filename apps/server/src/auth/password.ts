import { hash, verify } from '@node-rs/argon2';

// argon2id con i parametri raccomandati da OWASP (19 MiB, 2 iterazioni).
const opzioni = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, opzioni);
}

// Hash di una password qualsiasi: si verifica contro questo quando l'utente non esiste,
// così il tempo di risposta non rivela quali email sono registrate.
const hashFittizio = hashPassword('password-fittizia-per-tempi-costanti');

export async function verificaPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    await verify(await hashFittizio, password).catch(() => false);
    return false;
  }
  return verify(hash, password).catch(() => false);
}
