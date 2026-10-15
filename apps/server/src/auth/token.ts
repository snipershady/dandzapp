import { createHash, randomBytes } from 'node:crypto';

/** Token casuale da 256 bit, da consegnare all'utente (cookie o link). */
export function nuovoToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Nel database si salva solo l'hash del token: chi legge il DB non può usarlo. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
