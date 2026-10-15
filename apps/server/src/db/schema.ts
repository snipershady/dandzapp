import type {
  DefinizioneAvventura,
  Ruolo,
  RuoloPartecipante,
  StatoPartita,
} from '@dandzapp/shared';
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * Tipi delle tabelle MySQL per Kysely. Ogni migrazione che crea o modifica una
 * tabella aggiorna anche questo file.
 */
export type Database = {
  utenti: TabellaUtenti;
  sessioni: TabellaSessioni;
  recuperi_password: TabellaRecuperiPassword;
  avventure: TabellaAvventure;
  partite: TabellaPartite;
  personaggi: TabellaPersonaggi;
  partecipazioni: TabellaPartecipazioni;
  inviti: TabellaInviti;
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

export type TabellaAvventure = {
  id: Generated<number>;
  slug: string;
  titolo: string;
  sottotitolo: string | null;
  /** mysql2 restituisce le colonne JSON già decodificate; in scrittura si passa la stringa. */
  definizione: ColumnType<DefinizioneAvventura, string, string>;
  importata_il: ConDefault<Date>;
  aggiornata_il: ConDefault<Date>;
};
export type RigaAvventura = Selectable<TabellaAvventure>;

export type TabellaPartite = {
  id: Generated<number>;
  titolo: string;
  master_id: number;
  avventura_id: number;
  stato: ConDefault<StatoPartita>;
  /** BIGINT: mysql2 lo restituisce come stringa oltre 2^53, qui resta sempre piccolo. */
  versione: ConDefault<number>;
  creata_il: ConDefault<Date>;
  aggiornata_il: ConDefault<Date>;
};
export type RigaPartita = Selectable<TabellaPartite>;

export type TabellaPersonaggi = {
  id: Generated<number>;
  partita_id: number;
  nome: string;
  classe: ConDefault<string>;
  sigla: string;
  colore: string;
  utente_id: number | null;
  posto: number;
  x: number;
  y: number;
  creato_il: ConDefault<Date>;
};
export type RigaPersonaggio = Selectable<TabellaPersonaggi>;

export type TabellaPartecipazioni = {
  partita_id: number;
  utente_id: number;
  ruolo: RuoloPartecipante;
  personaggio_id: number | null;
  creata_il: ConDefault<Date>;
};

export type TabellaInviti = {
  id: Generated<number>;
  partita_id: number;
  email: string;
  ruolo: RuoloPartecipante;
  personaggio_id: number | null;
  token_hash: string;
  scade_il: Date;
  accettato_il: Date | null;
  accettato_da: number | null;
  creato_il: ConDefault<Date>;
};
export type RigaInvito = Selectable<TabellaInviti>;
