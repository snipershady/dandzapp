import { describe, expect, it } from 'vitest';
import { caricaConfig } from '../src/config.ts';
import { dsnSenzaPassword } from '../src/email/postino.ts';

const base = { DB_USER: 'u', DB_PASSWORD: '', DB_NAME: 'n' };

describe('MAILER_DSN', () => {
  it('vuoto: niente server di posta, le email vanno nel log', () => {
    expect(caricaConfig({ ...base }).mailer).toBeNull();
    expect(caricaConfig({ ...base, MAILER_DSN: '  ' }).mailer).toBeNull();
  });

  it('accetta smtp:// e smtps://, con o senza credenziali', () => {
    for (const dsn of [
      'smtp://127.0.0.1:1025',
      'smtp://utente:segreta@sandbox.smtp.mailtrap.io:2525',
      'smtps://utente%40dominio.it:p%40ss@smtp.esempio.it:465',
    ]) {
      expect(caricaConfig({ ...base, MAILER_DSN: dsn }).mailer).toBe(dsn);
    }
  });

  it('rifiuta altri formati con un messaggio chiaro', () => {
    for (const dsn of ['mailtrap.io:2525', 'http://smtp.esempio.it', 'smtp://host/percorso']) {
      expect(() => caricaConfig({ ...base, MAILER_DSN: dsn })).toThrow(/MAILER_DSN/);
    }
  });

  it('nei messaggi la password non compare', () => {
    expect(dsnSenzaPassword('smtp://utente:segreta@host:2525')).toBe('smtp://utente:***@host:2525');
    expect(dsnSenzaPassword('smtp://127.0.0.1:1025')).toBe('smtp://127.0.0.1:1025');
  });
});
