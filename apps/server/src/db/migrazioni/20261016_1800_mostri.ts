import { sql, type Kysely } from 'kysely';

const adesso = sql`CURRENT_TIMESTAMP(3)`;

/** Mostri del Master (RF-40…RF-44) e contatori delle loro sigle numerate. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('mostri')
    .addColumn('id', 'integer', (c) => c.unsigned().autoIncrement().primaryKey())
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    .addColumn('nome', 'varchar(60)', (c) => c.notNull())
    // Prefisso del tipo e numero progressivo: Sc1, Sc2, Sp1… (RF-41).
    .addColumn('sigla', 'varchar(8)', (c) => c.notNull())
    .addColumn('x', 'double precision', (c) => c.notNull())
    .addColumn('y', 'double precision', (c) => c.notNull())
    .addColumn('creato_il', sql`datetime(3)`, (c) => c.notNull().defaultTo(adesso))
    .addUniqueConstraint('mostri_partita_sigla', ['partita_id', 'sigla'])
    .execute();

  // Ultimo numero usato per ogni prefisso: le sigle proseguono anche dopo aver tolto dei
  // mostri, così una sigla non indica mai due mostri diversi nella stessa partita.
  await db.schema
    .createTable('mostri_sigle')
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    .addColumn('prefisso', 'varchar(3)', (c) => c.notNull())
    .addColumn('ultimo', 'integer', (c) => c.unsigned().notNull())
    .addPrimaryKeyConstraint('mostri_sigle_pk', ['partita_id', 'prefisso'])
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('mostri_sigle').execute();
  await db.schema.dropTable('mostri').execute();
}
