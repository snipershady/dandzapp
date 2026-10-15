import type { Ruolo } from '@dandzapp/shared';
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * Tipi delle tabelle MySQL per Kysely. Ogni migrazione che crea o modifica una
 * tabella aggiorna anche questo file.
 */
export type Database = {
  utenti: TabellaUtenti;
  sessioni: TabellaSessioni;
  recuperi_password: TabellaRecuperiPassword;
};

/** Colonna con valore predefinito: facoltativa in inserimento. */
type ConDefault<T> = ColumnType<T, T | undefined, T>;

export type TabellaUtenti = {
  id: Generated<number>;
  email: string;
  /** `null` finché l'utente non imposta la password (es. Master creato da riga di comando). */
  password_hash: string | null;
  nome: string;
  avatar_url: string | null;
  ruolo: ConDefault<Ruolo>;
  /** MySQL restituisce i boolean come 0/1. */
  attivo: ColumnType<number, boolean | undefined, boolean>;
  creato_il: ConDefault<Date>;
};
export type RigaUtente = Selectable<TabellaUtenti>;
export type NuovoUtente = Insertable<TabellaUtenti>;
export type ModificaUtente = Updateable<TabellaUtenti>;

export type TabellaSessioni = {
  token_hash: string;
  utente_id: number;
  scade_il: Date;
  creato_il: ConDefault<Date>;
};

export type TabellaRecuperiPassword = {
  token_hash: string;
  utente_id: number;
  scade_il: Date;
  usato_il: Date | null;
  creato_il: ConDefault<Date>;
};
