import { sql, type Kysely } from 'kysely';

/**
 * Zone scoperte di ogni partita (nebbia di guerra, RF-20…RF-23). Nasce con lo step 6,
 * perché la mappa dei giocatori mostra solo le zone scoperte (§15.3); il pannello del
 * Master per scoprirle arriva con lo step 7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('zone_scoperte')
    .addColumn('partita_id', 'integer', (c) =>
      c.unsigned().notNull().references('partite.id').onDelete('cascade'),
    )
    // Id della zona in `avventura.json` (minuscole, cifre e trattini bassi, max 64).
    .addColumn('zona_id', 'varchar(64)', (c) => c.notNull())
    .addPrimaryKeyConstraint('zone_scoperte_pk', ['partita_id', 'zona_id'])
    .execute();

  // Le partite già esistenti partono dalle zone iniziali della loro avventura (RF-23).
  await sql`
    INSERT INTO zone_scoperte (partita_id, zona_id)
    SELECT partite.id, iniziali.zona
    FROM partite
    JOIN avventure ON avventure.id = partite.avventura_id
    JOIN JSON_TABLE(
      avventure.definizione, '$.zoneIniziali[*]' COLUMNS (zona varchar(64) PATH '$')
    ) AS iniziali
  `.execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('zone_scoperte').execute();
}
