import { sql, type Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('avventure')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('slug', 'varchar(64)', (c) => c.notNull().unique())
    .addColumn('titolo', 'varchar(120)', (c) => c.notNull())
    .addColumn('sottotitolo', 'varchar(200)')
    // Contenuto di avventura.json, già validato. Le immagini stanno in DATA_DIR/avventure/<slug>/.
    .addColumn('definizione', 'json', (c) => c.notNull())
    .addColumn('importata_il', sql`datetime(3)`, (c) =>
      c.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`),
    )
    .addColumn('aggiornata_il', sql`datetime(3)`, (c) =>
      c.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`),
    )
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('avventure').execute();
}
