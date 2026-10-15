import { sql, type Kysely } from 'kysely';

// Migrazioni: tipo `any` perché descrivono lo schema di quel momento, non quello attuale.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('utenti')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('email', 'varchar(254)', (c) => c.notNull().unique())
    .addColumn('password_hash', 'varchar(255)')
    .addColumn('nome', 'varchar(60)', (c) => c.notNull())
    .addColumn('avatar_url', 'varchar(500)')
    .addColumn('ruolo', sql`enum('ROLE_MASTER','ROLE_PLAYER')`, (c) =>
      c.notNull().defaultTo('ROLE_PLAYER'),
    )
    .addColumn('attivo', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('creato_il', sql`datetime(3)`, (c) =>
      c.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`),
    )
    .execute();

  await db.schema
    .createTable('sessioni')
    .addColumn('token_hash', sql`char(64)`, (c) => c.primaryKey())
    .addColumn('utente_id', 'integer', (c) =>
      c.unsigned().notNull().references('utenti.id').onDelete('cascade'),
    )
    .addColumn('scade_il', sql`datetime(3)`, (c) => c.notNull())
    .addColumn('creato_il', sql`datetime(3)`, (c) =>
      c.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`),
    )
    .execute();
  await db.schema.createIndex('sessioni_utente').on('sessioni').column('utente_id').execute();

  await db.schema
    .createTable('recuperi_password')
    .addColumn('token_hash', sql`char(64)`, (c) => c.primaryKey())
    .addColumn('utente_id', 'integer', (c) =>
      c.unsigned().notNull().references('utenti.id').onDelete('cascade'),
    )
    .addColumn('scade_il', sql`datetime(3)`, (c) => c.notNull())
    .addColumn('usato_il', sql`datetime(3)`)
    .addColumn('creato_il', sql`datetime(3)`, (c) =>
      c.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`),
    )
    .execute();
  await db.schema
    .createIndex('recuperi_password_utente')
    .on('recuperi_password')
    .column('utente_id')
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('recuperi_password').execute();
  await db.schema.dropTable('sessioni').execute();
  await db.schema.dropTable('utenti').execute();
}
