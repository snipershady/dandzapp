import { sql, type Kysely } from 'kysely';

const adesso = sql`CURRENT_TIMESTAMP(3)`;

/**
 * Tiri di dado (RF-50…RF-63). Si conservano tutti (il tavolo ne mostra gli ultimi 40);
 * "Svuota storico" li cancella. Il nome del personaggio è copiato al momento del tiro,
 * così lo storico resta leggibile anche se il PG viene rinominato o eliminato.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tiri')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    .addColumn('utente_id', 'integer', (c) => c.unsigned().notNull().references('utenti.id'))
    .addColumn('personaggio_id', 'integer', (c) =>
      c.unsigned().references('personaggi.id').onDelete('set null'),
    )
    // "Master" per i tiri del Master, altrimenti il nome del PG di "Giochi come".
    .addColumn('personaggio_nome', 'varchar(60)', (c) => c.notNull())
    .addColumn('motivo', 'varchar(60)', (c) => c.notNull().defaultTo(''))
    .addColumn('n_dadi', 'smallint', (c) => c.unsigned().notNull())
    .addColumn('facce', 'smallint', (c) => c.unsigned().notNull())
    .addColumn('modificatore', 'smallint', (c) => c.notNull())
    .addColumn('risultati', 'json', (c) => c.notNull())
    .addColumn('totale', 'integer', (c) => c.notNull())
    .addColumn('nascosto', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('creato_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .execute();
  await db.schema
    .createIndex('tiri_partita_creato')
    .on('tiri')
    .columns(['partita_id', 'creato_il'])
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('tiri').execute();
}
