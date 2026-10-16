import {
  dentroPercorso,
  MAX_MOSTRI,
  zonaDi,
  type ComandoAggiungiMostri,
  type ComandoSpostaMostro,
  type DefinizioneAvventura,
  type Mostro,
  type RuoloInPartita,
} from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import type { RigaMostro } from '../db/schema.ts';
import { ErroreHttp } from '../http/errori.ts';
import { zoneScoperte } from './mappa.ts';

/**
 * Mostri (RF-40…RF-44). Li gestisce solo il Master. Un giocatore vede un mostro solo se
 * sta dentro una zona scoperta: fuori dalle zone, o in una zona coperta, il mostro non
 * arriva nemmeno nei dati (RF-44).
 */

async function definizione(db: Db, partitaId: number): Promise<DefinizioneAvventura> {
  const { definizione } = await db
    .selectFrom('partite')
    .innerJoin('avventure', 'avventure.id', 'partite.avventura_id')
    .select('avventure.definizione')
    .where('partite.id', '=', partitaId)
    .executeTakeFirstOrThrow();
  return definizione;
}

/** Funzione che dice se un punto è visibile ai giocatori (dentro una zona scoperta). */
export async function visibilita(
  db: Db,
  partitaId: number,
): Promise<(punto: { x: number; y: number }) => boolean> {
  const [def, scoperte] = await Promise.all([
    definizione(db, partitaId),
    zoneScoperte(db, partitaId),
  ]);
  const zone = def.zone.filter((z) => scoperte.includes(z.id));
  return ({ x, y }) => zonaDi(zone, [x, y]) !== undefined;
}

const aMostro = (r: RigaMostro): Mostro => ({
  id: r.id,
  nome: r.nome,
  sigla: r.sigla,
  x: r.x,
  y: r.y,
});

/** I mostri che chi ha quel ruolo può vedere. */
export async function elencaMostri(
  db: Db,
  partitaId: number,
  ruolo: RuoloInPartita,
): Promise<Mostro[]> {
  const righe = await db
    .selectFrom('mostri')
    .selectAll()
    .where('partita_id', '=', partitaId)
    .orderBy('id')
    .execute();
  const mostri = righe.map(aMostro);
  if (ruolo === 'master') return mostri;
  const visibile = await visibilita(db, partitaId);
  return mostri.filter(visibile);
}

/** Tipi di mostro dell'avventura, per il modulo del Master. */
export async function tipiMostro(db: Db, partitaId: number) {
  return (await definizione(db, partitaId)).mostri;
}

/** Prefisso della sigla per un nome libero: le prime due lettere ("Bandito" → "Ba"). */
export function prefissoDa(nome: string): string {
  const lettere = [...nome.normalize('NFC')].filter((c) => /[A-Za-zÀ-ÿ]/.test(c));
  if (lettere.length === 0) return 'Mo';
  return (lettere[0] ?? '').toUpperCase() + (lettere[1] ?? '').toLowerCase();
}

/**
 * Posizioni di `n` mostri raggruppati attorno al centro di una zona (RF-41): i punti più
 * vicini al centro su una griglia di poco meno di un quadretto, purché dentro la zona,
 * così un mostro in un corridoio stretto non finisce nella roccia (e resta visibile ai
 * giocatori). Se la zona è troppo piccola, la griglia si infittisce.
 */
export function raggruppa(
  zona: DefinizioneAvventura['zone'][number],
  n: number,
  quadretto: number,
): { x: number; y: number }[] {
  const [cx, cy] = zona.centro;
  for (const fattore of [0.9, 0.6, 0.4, 0.25]) {
    const passo = quadretto * fattore;
    const candidati: { x: number; y: number; d: number }[] = [];
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        const x = cx + i * passo;
        const y = cy + j * passo;
        if (dentroPercorso([x, y], zona.percorso)) candidati.push({ x, y, d: i * i + j * j });
      }
    }
    if (candidati.length >= n) {
      return candidati
        .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x)
        .slice(0, n)
        .map(({ x, y }) => ({ x, y }));
    }
  }
  return Array.from({ length: n }, () => ({ x: cx, y: cy }));
}

/**
 * Aggiunge i mostri al centro della zona scelta (RF-40, RF-41). Le sigle proseguono la
 * numerazione del prefisso nella partita. Va eseguita dentro `modifica()`, che blocca la
 * partita: i contatori delle sigle non si contendono. Restituisce se i giocatori vedono
 * i nuovi mostri.
 */
export async function aggiungiMostri(
  db: Db,
  partitaId: number,
  c: ComandoAggiungiMostri,
): Promise<{ visibili: boolean }> {
  const def = await definizione(db, partitaId);
  const zona = def.zone.find((z) => z.id === c.zonaId);
  if (!zona) throw new ErroreHttp(404, 'Zona inesistente');

  let nome: string;
  let prefisso: string;
  if (c.tipo !== undefined) {
    const tipo = def.mostri.find((m) => m.sigla === c.tipo);
    if (!tipo) throw new ErroreHttp(400, 'Tipo di mostro inesistente');
    ({ nome, sigla: prefisso } = tipo);
  } else {
    nome = c.altro ?? '';
    prefisso = prefissoDa(nome);
  }

  const { n } = await db
    .selectFrom('mostri')
    .select((e) => e.fn.countAll<number>().as('n'))
    .where('partita_id', '=', partitaId)
    .executeTakeFirstOrThrow();
  if (Number(n) + c.quantita > MAX_MOSTRI) {
    throw new ErroreHttp(409, `Al massimo ${MAX_MOSTRI} mostri sul tavolo`);
  }

  const contatore = await db
    .selectFrom('mostri_sigle')
    .select('ultimo')
    .where('partita_id', '=', partitaId)
    .where('prefisso', '=', prefisso)
    .executeTakeFirst();
  const primo = (contatore?.ultimo ?? 0) + 1;
  const ultimo = primo + c.quantita - 1;
  if (contatore) {
    await db
      .updateTable('mostri_sigle')
      .set({ ultimo })
      .where('partita_id', '=', partitaId)
      .where('prefisso', '=', prefisso)
      .execute();
  } else {
    await db
      .insertInto('mostri_sigle')
      .values({ partita_id: partitaId, prefisso, ultimo })
      .execute();
  }

  const posizioni = raggruppa(zona, c.quantita, def.mappa.quadretto.px);
  await db
    .insertInto('mostri')
    .values(
      posizioni.map(({ x, y }, i) => ({
        partita_id: partitaId,
        nome,
        sigla: `${prefisso}${primo + i}`,
        x,
        y,
      })),
    )
    .execute();
  const visibile = await visibilita(db, partitaId);
  return { visibili: posizioni.some(visibile) };
}

async function trovaMostro(db: Db, partitaId: number, mostroId: number): Promise<RigaMostro> {
  const riga = await db
    .selectFrom('mostri')
    .selectAll()
    .where('id', '=', mostroId)
    .where('partita_id', '=', partitaId)
    .executeTakeFirst();
  if (!riga) throw new ErroreHttp(404, 'Mostro non trovato');
  return riga;
}

/** Sposta un mostro (RF-43). Dice se i giocatori lo vedevano prima o lo vedono dopo. */
export async function spostaMostro(
  db: Db,
  partitaId: number,
  { mostroId, x, y }: ComandoSpostaMostro,
): Promise<{ visibile: boolean }> {
  const { mappa } = await definizione(db, partitaId);
  if (x > mappa.larghezza || y > mappa.altezza) {
    throw new ErroreHttp(400, 'Il mostro deve restare sulla mappa');
  }
  const prima = await trovaMostro(db, partitaId, mostroId);
  await db.updateTable('mostri').set({ x, y }).where('id', '=', mostroId).execute();
  const visibile = await visibilita(db, partitaId);
  return { visibile: visibile(prima) || visibile({ x, y }) };
}

/** Toglie un mostro (RF-43). Dice se i giocatori lo vedevano. */
export async function togliMostro(
  db: Db,
  partitaId: number,
  mostroId: number,
): Promise<{ visibile: boolean }> {
  const mostro = await trovaMostro(db, partitaId, mostroId);
  await db.deleteFrom('mostri').where('id', '=', mostroId).execute();
  return { visibile: (await visibilita(db, partitaId))(mostro) };
}

/** Toglie tutti i mostri della partita (RF-43). Dice se i giocatori ne vedevano qualcuno. */
export async function togliTuttiIMostri(db: Db, partitaId: number): Promise<{ visibile: boolean }> {
  const mostri = await db
    .selectFrom('mostri')
    .select(['x', 'y'])
    .where('partita_id', '=', partitaId)
    .execute();
  await db.deleteFrom('mostri').where('partita_id', '=', partitaId).execute();
  const visibile = await visibilita(db, partitaId);
  return { visibile: mostri.some(visibile) };
}
