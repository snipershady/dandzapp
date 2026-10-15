import { Kysely, MysqlDialect, sql } from 'kysely';
import { createPool } from 'mysql2';
import type { Config } from '../config.ts';
import type { Database } from './schema.ts';

export type Db = Kysely<Database>;

export function creaDatabase(config: Config['db']): Db {
  return new Kysely<Database>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: config.host,
        port: config.porta,
        user: config.utente,
        password: config.password,
        database: config.nome,
        charset: 'utf8mb4_0900_ai_ci',
        timezone: 'Z',
        connectionLimit: 10,
        connectTimeout: 5_000,
      }),
    }),
  });
}

/** `true` se il database risponde. */
export async function databaseRaggiungibile(db: Db): Promise<boolean> {
  try {
    await sql`SELECT 1`.execute(db);
    return true;
  } catch {
    return false;
  }
}
