import { randomBytes } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { DefinizioneAvventura } from '@dandzapp/shared';
import { z } from 'zod';
import type { Db } from '../db/database.ts';
import { dimensioniPng } from './png.ts';

export class ErroreImportazione extends Error {}

/** Cartella in cui il server tiene le immagini di un'avventura importata. */
export function cartellaAvventura(cartellaDati: string, slug: string): string {
  return path.join(cartellaDati, 'avventure', slug);
}

/**
 * Importa (o aggiorna) un'avventura da una cartella prodotta dal generatore di mappe.
 *
 * Valida `avventura.json`, controlla che le immagini esistano e abbiano le dimensioni
 * dichiarate, copia SOLO le immagini dichiarate (mai la cartella `master/`) nella
 * cartella dati del server e salva la definizione nel database.
 */
export async function importaAvventura(
  db: Db,
  { cartella, cartellaDati }: { cartella: string; cartellaDati: string },
): Promise<{ definizione: DefinizioneAvventura; nuova: boolean }> {
  const sorgente = path.resolve(cartella);
  const definizione = await leggiDefinizione(path.join(sorgente, 'avventura.json'));

  const immagini = [
    { file: definizione.mappa.immagine, ...definizione.mappa },
    ...definizione.segreti.map((s) => ({ file: s.immagine, ...s })),
  ];
  for (const { file, larghezza, altezza } of immagini) {
    const percorso = path.join(sorgente, file);
    let dimensioni;
    try {
      dimensioni = await dimensioniPng(percorso);
    } catch {
      throw new ErroreImportazione(`Immagine mancante: ${file}`);
    }
    if (!dimensioni) throw new ErroreImportazione(`Non è un'immagine PNG: ${file}`);
    if (dimensioni.larghezza !== larghezza || dimensioni.altezza !== altezza) {
      throw new ErroreImportazione(
        `${file} misura ${dimensioni.larghezza}×${dimensioni.altezza}, ` +
          `ma avventura.json dichiara ${larghezza}×${altezza}`,
      );
    }
  }

  // Copia in una cartella temporanea e poi sostituzione: un'importazione fallita
  // non lascia mai l'avventura a metà.
  const destinazione = cartellaAvventura(cartellaDati, definizione.id);
  const temporanea = `${destinazione}.importazione-${randomBytes(4).toString('hex')}`;
  try {
    for (const { file } of immagini) {
      await mkdir(path.dirname(path.join(temporanea, file)), { recursive: true });
      await cp(path.join(sorgente, file), path.join(temporanea, file));
    }
    await rm(destinazione, { recursive: true, force: true });
    await rename(temporanea, destinazione);
  } finally {
    await rm(temporanea, { recursive: true, force: true });
  }

  const esistente = await db
    .selectFrom('avventure')
    .select('id')
    .where('slug', '=', definizione.id)
    .executeTakeFirst();
  const valori = {
    titolo: definizione.titolo,
    sottotitolo: definizione.sottotitolo ?? null,
    definizione: JSON.stringify(definizione),
  };
  if (esistente) {
    await db
      .updateTable('avventure')
      .set({ ...valori, aggiornata_il: new Date() })
      .where('id', '=', esistente.id)
      .execute();
  } else {
    await db
      .insertInto('avventure')
      .values({ slug: definizione.id, ...valori })
      .execute();
  }
  return { definizione, nuova: !esistente };
}

async function leggiDefinizione(file: string): Promise<DefinizioneAvventura> {
  let testo: string;
  try {
    testo = await readFile(file, 'utf8');
  } catch {
    throw new ErroreImportazione(`File mancante: ${file}`);
  }
  let dati: unknown;
  try {
    dati = JSON.parse(testo);
  } catch (e) {
    throw new ErroreImportazione(`avventura.json non è un JSON valido: ${(e as Error).message}`);
  }
  const risultato = DefinizioneAvventura.safeParse(dati);
  if (!risultato.success) {
    throw new ErroreImportazione(`avventura.json non valido:\n${z.prettifyError(risultato.error)}`);
  }
  return risultato.data;
}
