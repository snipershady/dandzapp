import { sql, type Kysely } from 'kysely';

const adesso = sql`CURRENT_TIMESTAMP(3)`;

/**
 * Narrazione "Il Master legge" (RF-70). Ogni testo pubblicato resta nello storico della
 * partita, così il Master può ripubblicarlo; la partita indica quello mostrato ora.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('narrazioni')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    .addColumn('testo', 'text', (c) => c.notNull())
    .addColumn('creata_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    // Ultima volta che è stata mostrata al tavolo (alla creazione o ripubblicandola).
    .addColumn('pubblicata_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .execute();
  await db.schema
    .createIndex('narrazioni_partita')
    .on('narrazioni')
    .columns(['partita_id', 'pubblicata_il'])
    .execute();

  // Testo mostrato ora al tavolo; `NULL` = nascosto.
  await db.schema
    .alterTable('partite')
    .addColumn('narrazione_id', 'integer', (c) =>
      c.unsigned().references('narrazioni.id').onDelete('set null'),
    )
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  // MySQL nomina la chiave esterna "partite_ibfk_<n>": la si cerca per colonna.
  const fk = await sql<{ nome: string }>`
    SELECT CONSTRAINT_NAME AS nome FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partite'
      AND COLUMN_NAME = 'narrazione_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  `.execute(db);
  for (const { nome } of fk.rows) {
    await db.schema.alterTable('partite').dropConstraint(nome).execute();
  }
  await db.schema.alterTable('partite').dropColumn('narrazione_id').execute();
  await db.schema.dropTable('narrazioni').execute();
}
