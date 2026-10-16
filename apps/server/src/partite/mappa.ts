import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DefinizioneAvventura, MappaPartita, RuoloInPartita } from '@dandzapp/shared';
import sharp, { type Sharp } from 'sharp';
import { cartellaAvventura } from '../avventure/importa.ts';
import type { Db } from '../db/database.ts';

/**
 * Mappa del tavolo (RF-10, §15.3). Ai giocatori e agli osservatori non arriva mai
 * l'immagine intera: il server compone un PNG con le sole zone scoperte, trasparente
 * altrove (la nebbia la disegna il browser). Il Master riceve l'immagine intera.
 *
 * Le immagini composte stanno in `DATA_DIR/cache/mappe/<avventura>/` con un nome che
 * dipende dalle zone scoperte e dalla data d'importazione dell'avventura: partite con
 * le stesse zone scoperte condividono la stessa immagine, e una reimportazione le
 * rigenera tutte.
 */

type DatiMappa = {
  slug: string;
  definizione: DefinizioneAvventura;
  aggiornataIl: Date;
  zone: string[];
};

export async function zoneScoperte(db: Db, partitaId: number): Promise<string[]> {
  const righe = await db
    .selectFrom('zone_scoperte')
    .select('zona_id')
    .where('partita_id', '=', partitaId)
    .orderBy('zona_id')
    .execute();
  return righe.map((r) => r.zona_id);
}

async function datiMappa(db: Db, partitaId: number): Promise<DatiMappa> {
  const [avventura, zone] = await Promise.all([
    db
      .selectFrom('partite')
      .innerJoin('avventure', 'avventure.id', 'partite.avventura_id')
      .select(['avventure.slug', 'avventure.definizione', 'avventure.aggiornata_il'])
      .where('partite.id', '=', partitaId)
      .executeTakeFirstOrThrow(),
    zoneScoperte(db, partitaId),
  ]);
  return {
    slug: avventura.slug,
    definizione: avventura.definizione,
    aggiornataIl: avventura.aggiornata_il,
    zone,
  };
}

/** Nome dell'immagine per quel ruolo: cambia solo quando cambia il contenuto. */
function chiave({ aggiornataIl, zone }: DatiMappa, ruolo: RuoloInPartita): string {
  const versioneAvventura = aggiornataIl.getTime().toString(36);
  if (ruolo === 'master') return `intera-${versioneAvventura}`;
  const impronta = createHash('sha256').update(zone.join(',')).digest('hex').slice(0, 20);
  return `zone-${versioneAvventura}-${impronta}`;
}

/** Dimensioni, scala e chiave della mappa, per l'istantanea. */
export async function infoMappa(
  db: Db,
  partitaId: number,
  ruolo: RuoloInPartita,
): Promise<MappaPartita> {
  const dati = await datiMappa(db, partitaId);
  const { larghezza, altezza, quadretto } = dati.definizione.mappa;
  return { larghezza, altezza, quadretto, chiave: chiave(dati, ruolo) };
}

/** File PNG da inviare a chi ha quel ruolo, composto se non è già in cache. */
export async function fileMappa(
  db: Db,
  cartellaDati: string,
  partitaId: number,
  ruolo: RuoloInPartita,
): Promise<{ file: string; chiave: string }> {
  const dati = await datiMappa(db, partitaId);
  const originale = path.join(
    cartellaAvventura(cartellaDati, dati.slug),
    dati.definizione.mappa.immagine,
  );
  const nome = chiave(dati, ruolo);
  if (ruolo === 'master') return { file: originale, chiave: nome };

  const cartella = path.join(cartellaDati, 'cache', 'mappe', dati.slug);
  const file = path.join(cartella, `${nome}.png`);
  if (await esiste(file)) return { file, chiave: nome };

  await mkdir(cartella, { recursive: true });
  // Si scrive su un file temporaneo e poi lo si rinomina: due richieste contemporanee
  // non lasciano mai un'immagine a metà.
  const temporaneo = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await componi(originale, dati).toFile(temporaneo);
  await rename(temporaneo, file);
  return { file, chiave: nome };
}

/** L'immagine con le sole zone scoperte: la maschera è fatta dai loro poligoni. */
function componi(originale: string, { definizione, zone }: DatiMappa): Sharp {
  const { larghezza, altezza } = definizione.mappa;
  const scoperte = definizione.zone.filter((z) => zone.includes(z.id));
  if (scoperte.length === 0) {
    return sharp({
      create: {
        width: larghezza,
        height: altezza,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png();
  }
  // I percorsi sono validati all'importazione: solo comandi M, L, Z e numeri.
  const maschera =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezza}" height="${altezza}">` +
    scoperte.map((z) => `<path fill="#fff" d="${z.percorso}"/>`).join('') +
    '</svg>';
  return sharp(originale)
    .ensureAlpha()
    .composite([{ input: Buffer.from(maschera), blend: 'dest-in' }])
    .png();
}

async function esiste(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
