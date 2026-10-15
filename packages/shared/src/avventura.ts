import { z } from 'zod';

/**
 * File `avventura.json` prodotto da strumenti/mappe/genera_mappa.py e importato con
 * `npm run avventura:importa`. Coordinate in pixel della mappa (RF-12).
 */

const IdAvventura = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Usa solo minuscole, cifre e trattini')
  .max(64);
const IdElemento = z
  .string()
  .regex(/^[a-z0-9_]+$/, 'Usa solo minuscole, cifre e trattini bassi')
  .max(64);
const Punto = z.tuple([z.number().nonnegative(), z.number().nonnegative()]);
/** Percorso SVG fatto solo di segmenti (M, L, Z): niente altro può arrivare al browser. */
const Percorso = z
  .string()
  .max(200_000)
  .regex(/^[MLZ0-9.,\s-]+$/, 'Percorso non valido: sono ammessi solo i comandi M, L e Z');
/** File PNG relativo alla cartella dell'avventura, senza risalire di cartella. */
const FilePng = z
  .string()
  .regex(/^[a-z0-9_-]+(\/[a-z0-9_-]+)*\.png$/, 'Percorso del file non valido');
const Intero = z.number().int().nonnegative();
const Positivo = z.number().int().positive();

export const Zona = z.object({
  id: IdElemento,
  nome: z.string().trim().min(1).max(120),
  percorso: Percorso,
  /** Punto interno alla zona, dove compaiono i mostri (RF-41). */
  centro: Punto,
});
export type Zona = z.infer<typeof Zona>;

export const Segreto = z.object({
  id: IdElemento,
  /** Zona che, scoperta, rende visibile il segreto (RF-24). */
  zona: IdElemento,
  immagine: FilePng,
  x: Intero,
  y: Intero,
  larghezza: Positivo,
  altezza: Positivo,
});
export type Segreto = z.infer<typeof Segreto>;

export const TipoMostro = z.object({
  nome: z.string().trim().min(1).max(60),
  sigla: z
    .string()
    .regex(/^[A-Za-zÀ-ÿ]{1,3}$/, 'La sigla ha da 1 a 3 lettere')
    .describe('Prefisso delle pedine: Sc1, Sc2…'),
});
export type TipoMostro = z.infer<typeof TipoMostro>;

export const DefinizioneAvventura = z
  .object({
    formato: z.literal(1),
    id: IdAvventura,
    titolo: z.string().trim().min(1).max(120),
    sottotitolo: z.string().trim().max(200).optional(),
    mappa: z.object({
      immagine: FilePng,
      larghezza: Positivo.max(10_000),
      altezza: Positivo.max(10_000),
      quadretto: z.object({
        px: Positivo,
        metri: z.number().positive(),
        piedi: z.number().positive(),
      }),
    }),
    zone: z.array(Zona).min(1).max(500),
    zoneIniziali: z.array(IdElemento).min(1),
    segreti: z.array(Segreto).max(100),
    /** Posti di partenza dei PG, in ordine (RF-34): il primo PG va nel primo posto. */
    partenze: z.array(Punto).min(1).max(20),
    mostri: z.array(TipoMostro).max(50),
  })
  .superRefine((a, ctx) => {
    const problema = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const dentro = ([x, y]: [number, number]) => x <= a.mappa.larghezza && y <= a.mappa.altezza;

    const zone = new Set<string>();
    a.zone.forEach((z, i) => {
      if (zone.has(z.id)) problema(['zone', i, 'id'], `Zona duplicata: ${z.id}`);
      zone.add(z.id);
      if (!dentro(z.centro)) problema(['zone', i, 'centro'], 'Centro fuori dalla mappa');
    });
    a.zoneIniziali.forEach((id, i) => {
      if (!zone.has(id)) problema(['zoneIniziali', i], `Zona inesistente: ${id}`);
    });
    const segreti = new Set<string>();
    a.segreti.forEach((s, i) => {
      if (segreti.has(s.id)) problema(['segreti', i, 'id'], `Segreto duplicato: ${s.id}`);
      segreti.add(s.id);
      if (!zone.has(s.zona)) problema(['segreti', i, 'zona'], `Zona inesistente: ${s.zona}`);
      if (s.x + s.larghezza > a.mappa.larghezza || s.y + s.altezza > a.mappa.altezza) {
        problema(['segreti', i], 'Il segreto esce dalla mappa');
      }
    });
    a.partenze.forEach((p, i) => {
      if (!dentro(p)) problema(['partenze', i], 'Posto di partenza fuori dalla mappa');
    });
    const sigle = new Set<string>();
    a.mostri.forEach((m, i) => {
      if (sigle.has(m.sigla)) problema(['mostri', i, 'sigla'], `Sigla duplicata: ${m.sigla}`);
      sigle.add(m.sigla);
    });
  });
export type DefinizioneAvventura = z.infer<typeof DefinizioneAvventura>;

/** Avventura nell'elenco del Master: solo dati senza spoiler (né zone né mappa). */
export const RiepilogoAvventura = z.object({
  id: z.string(),
  titolo: z.string(),
  sottotitolo: z.string().nullable(),
  numeroZone: z.number().int(),
  numeroPartenze: z.number().int(),
  mostri: z.array(z.string()),
});
export type RiepilogoAvventura = z.infer<typeof RiepilogoAvventura>;

export const RispostaElencoAvventure = z.object({ avventure: z.array(RiepilogoAvventura) });
export type RispostaElencoAvventure = z.infer<typeof RispostaElencoAvventure>;
