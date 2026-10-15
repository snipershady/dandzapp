import { sql, type Kysely } from 'kysely';

const adesso = sql`CURRENT_TIMESTAMP(3)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('partite')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('titolo', 'varchar(120)', (c) => c.notNull())
    .addColumn('master_id', 'integer', (c) => c.unsigned().notNull().references('utenti.id'))
    // Una partita usa una sola avventura per tutta la sua durata.
    .addColumn('avventura_id', 'integer', (c) => c.unsigned().notNull().references('avventure.id'))
    .addColumn('stato', sql`enum('attiva','archiviata')`, (c) => c.notNull().defaultTo('attiva'))
    // Incrementata a ogni modifica dello stato di gioco (tempo reale, step 5).
    .addColumn('versione', 'bigint', (c) => c.unsigned().notNull().defaultTo(0))
    .addColumn('creata_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .addColumn('aggiornata_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .execute();
  await db.schema.createIndex('partite_master').on('partite').column('master_id').execute();

  await db.schema
    .createTable('personaggi')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    .addColumn('nome', 'varchar(60)', (c) => c.notNull())
    .addColumn('classe', 'varchar(40)', (c) => c.notNull().defaultTo(''))
    .addColumn('sigla', 'varchar(3)', (c) => c.notNull())
    .addColumn('colore', sql`char(7)`, (c) => c.notNull())
    // Giocatore che lo controlla; resta il PG se il giocatore lascia la partita.
    .addColumn('utente_id', 'integer', (c) =>
      c.unsigned().references('utenti.id').onDelete('set null'),
    )
    // Posto di partenza (indice in `partenze` dell'avventura) e posizione sulla mappa.
    .addColumn('posto', 'integer', (c) => c.unsigned().notNull())
    .addColumn('x', 'double precision', (c) => c.notNull())
    .addColumn('y', 'double precision', (c) => c.notNull())
    .addColumn('creato_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .addUniqueConstraint('personaggi_partita_nome', ['partita_id', 'nome'])
    .addUniqueConstraint('personaggi_partita_sigla', ['partita_id', 'sigla'])
    .execute();

  await db.schema
    .createTable('partecipazioni')
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    .addColumn('utente_id', 'integer', (c) =>
      c.unsigned().notNull().references('utenti.id').onDelete('cascade'),
    )
    .addColumn('ruolo', sql`enum('giocatore','osservatore')`, (c) => c.notNull())
    // PG scelto con "Giochi come" (RF-03).
    .addColumn('personaggio_id', 'integer', (c) =>
      c.unsigned().references('personaggi.id').onDelete('set null'),
    )
    .addColumn('creata_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .addPrimaryKeyConstraint('partecipazioni_pk', ['partita_id', 'utente_id'])
    .execute();
  await db.schema
    .createIndex('partecipazioni_utente')
    .on('partecipazioni')
    .column('utente_id')
    .execute();

  await db.schema
    .createTable('inviti')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    .addColumn('email', 'varchar(254)', (c) => c.notNull())
    .addColumn('ruolo', sql`enum('giocatore','osservatore')`, (c) => c.notNull())
    .addColumn('personaggio_id', 'integer', (c) =>
      c.unsigned().references('personaggi.id').onDelete('set null'),
    )
    .addColumn('token_hash', sql`char(64)`, (c) => c.notNull().unique())
    .addColumn('scade_il', sql`datetime(3)`, (c) => c.notNull())
    .addColumn('accettato_il', sql`datetime(3)`)
    .addColumn('accettato_da', 'integer', (c) =>
      c.unsigned().references('utenti.id').onDelete('set null'),
    )
    .addColumn('creato_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .execute();
  await db.schema
    .createIndex('inviti_partita_email')
    .on('inviti')
    .columns(['partita_id', 'email'])
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('inviti').execute();
  await db.schema.dropTable('partecipazioni').execute();
  await db.schema.dropTable('personaggi').execute();
  await db.schema.dropTable('partite').execute();
}
