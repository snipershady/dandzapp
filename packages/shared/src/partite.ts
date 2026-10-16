import { z } from 'zod';

/** Ruolo di chi partecipa a una partita su invito (§4.2). Il Master è chi l'ha creata. */
export const RuoloPartecipante = z.enum(['giocatore', 'osservatore']);
export type RuoloPartecipante = z.infer<typeof RuoloPartecipante>;

export const RuoloInPartita = z.enum(['master', 'giocatore', 'osservatore']);
export type RuoloInPartita = z.infer<typeof RuoloInPartita>;

export const StatoPartita = z.enum(['attiva', 'archiviata']);
export type StatoPartita = z.infer<typeof StatoPartita>;

const titolo = z
  .string({ error: 'Inserisci il titolo' })
  .trim()
  .min(2, 'Il titolo deve avere almeno 2 caratteri')
  .max(120, 'Il titolo può avere al massimo 120 caratteri');

const email = z
  .string({ error: "Inserisci l'email" })
  .trim()
  .toLowerCase()
  .max(254, 'Email troppo lunga')
  .pipe(z.email({ error: 'Email non valida' }));

const id = z.number().int().positive();

// ---------------------------------------------------------------- partite

export const CorpoNuovaPartita = z.object({
  titolo,
  avventura: z.string({ error: "Scegli un'avventura" }).min(1, "Scegli un'avventura").max(64),
});
export type CorpoNuovaPartita = z.infer<typeof CorpoNuovaPartita>;

export const CorpoModificaPartita = z
  .object({ titolo: titolo.optional(), stato: StatoPartita.optional() })
  .strict()
  .refine((m) => m.titolo !== undefined || m.stato !== undefined, 'Nessuna modifica indicata');
export type CorpoModificaPartita = z.infer<typeof CorpoModificaPartita>;

export const RiepilogoPartita = z.object({
  id,
  titolo: z.string(),
  stato: StatoPartita,
  avventura: z.object({ titolo: z.string(), sottotitolo: z.string().nullable() }),
  master: z.object({ id, nome: z.string() }),
  mioRuolo: RuoloInPartita,
  numeroPartecipanti: z.number().int(),
});
export type RiepilogoPartita = z.infer<typeof RiepilogoPartita>;

export const RispostaElencoPartite = z.object({
  /** Partite di cui l'utente è il Master. */
  conduco: z.array(RiepilogoPartita),
  /** Partite a cui l'utente partecipa come giocatore o osservatore. */
  partecipo: z.array(RiepilogoPartita),
});
export type RispostaElencoPartite = z.infer<typeof RispostaElencoPartite>;

export const RispostaPartitaCreata = z.object({ id });
export type RispostaPartitaCreata = z.infer<typeof RispostaPartitaCreata>;

// ---------------------------------------------------------------- personaggi

export const COLORE_PREDEFINITO = '#1f4f8f';

export const CorpoPersonaggio = z.object({
  nome: z
    .string({ error: 'Inserisci il nome' })
    .trim()
    .min(1, 'Inserisci il nome')
    .max(60, 'Il nome può avere al massimo 60 caratteri'),
  classe: z.string().trim().max(40, 'Massimo 40 caratteri').default(''),
  sigla: z
    .string({ error: 'Inserisci la sigla' })
    .trim()
    .regex(/^[A-Za-zÀ-ÿ]{1,3}$/, 'La sigla ha da 1 a 3 lettere'),
  colore: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido')
    .transform((c) => c.toLowerCase())
    .default(COLORE_PREDEFINITO),
  /** Giocatore che lo controlla: un partecipante con ruolo "giocatore", o nessuno. */
  utenteId: id.nullable().default(null),
});
export type CorpoPersonaggio = z.input<typeof CorpoPersonaggio>;

export const CorpoModificaPersonaggio = z
  .object({
    nome: CorpoPersonaggio.shape.nome.optional(),
    classe: z.string().trim().max(40, 'Massimo 40 caratteri').optional(),
    sigla: CorpoPersonaggio.shape.sigla.optional(),
    colore: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido')
      .transform((c) => c.toLowerCase())
      .optional(),
    utenteId: id.nullable().optional(),
  })
  .strict()
  .refine((m) => Object.values(m).some((v) => v !== undefined), 'Nessuna modifica indicata');
export type CorpoModificaPersonaggio = z.input<typeof CorpoModificaPersonaggio>;

export const Personaggio = z.object({
  id,
  nome: z.string(),
  classe: z.string(),
  sigla: z.string(),
  colore: z.string(),
  utenteId: id.nullable(),
  /** Posizione della pedina in coordinate della mappa (RF-12). */
  x: z.number(),
  y: z.number(),
});
export type Personaggio = z.infer<typeof Personaggio>;

// ---------------------------------------------------------------- partecipanti e inviti

export const Partecipante = z.object({
  utenteId: id,
  nome: z.string(),
  ruolo: RuoloPartecipante,
  /** "Giochi come" (RF-03). */
  personaggioId: id.nullable(),
});
export type Partecipante = z.infer<typeof Partecipante>;

/** "Giochi come" (RF-03): il PG scelto dal giocatore, o nessuno. */
export const CorpoGiochiCome = z.object({ personaggioId: id.nullable() }).strict();
export type CorpoGiochiCome = z.infer<typeof CorpoGiochiCome>;

export const CorpoModificaPartecipante = z.object({ ruolo: RuoloPartecipante }).strict();
export type CorpoModificaPartecipante = z.infer<typeof CorpoModificaPartecipante>;

export const CorpoInvito = z
  .object({
    email,
    ruolo: RuoloPartecipante.default('giocatore'),
    personaggioId: id.nullable().default(null),
  })
  .refine((i) => i.ruolo === 'giocatore' || i.personaggioId === null, {
    path: ['personaggioId'],
    message: 'Un osservatore non controlla personaggi',
  });
export type CorpoInvito = z.input<typeof CorpoInvito>;

export const Invito = z.object({
  id,
  email: z.string(),
  ruolo: RuoloPartecipante,
  personaggioId: id.nullable(),
  scadeIl: z.string(),
  scaduto: z.boolean(),
});
export type Invito = z.infer<typeof Invito>;

export const RispostaInvitoCreato = z.object({
  invito: Invito,
  /** Link personale da consegnare anche a mano (es. in chat): vale solo per l'email invitata. */
  link: z.string(),
});
export type RispostaInvitoCreato = z.infer<typeof RispostaInvitoCreato>;

/** Quel che vede chi apre un link d'invito, anche prima di accedere. */
export const InfoInvito = z.object({
  partita: z.object({ titolo: z.string() }),
  master: z.object({ nome: z.string() }),
  email: z.string(),
  ruolo: RuoloPartecipante,
  personaggio: z.string().nullable(),
  stato: z.enum(['valido', 'scaduto', 'usato', 'partita archiviata']),
});
export type InfoInvito = z.infer<typeof InfoInvito>;

// ---------------------------------------------------------------- dettaglio

/**
 * Mappa del tavolo (RF-10). L'immagine si scarica da `/api/partite/:id/mappa`: al Master
 * arriva intera, agli altri con le sole zone scoperte. `chiave` cambia quando cambia
 * l'immagine, così il browser sa quando ricaricarla.
 */
export const MappaPartita = z.object({
  larghezza: z.number().int().positive(),
  altezza: z.number().int().positive(),
  quadretto: z.object({ px: z.number().positive(), metri: z.number(), piedi: z.number() }),
  chiave: z.string(),
});
export type MappaPartita = z.infer<typeof MappaPartita>;

/** Zona della nebbia vista dal Master (RF-22): ai giocatori non arriva nessuna zona. */
export const ZonaPartita = z.object({
  id: z.string(),
  nome: z.string(),
  /** Poligono in coordinate mappa (solo comandi M, L, Z). */
  percorso: z.string(),
  scoperta: z.boolean(),
});
export type ZonaPartita = z.infer<typeof ZonaPartita>;

export const DettaglioPartita = z.object({
  partita: RiepilogoPartita,
  /** Versione dello stato di gioco: cresce a ogni modifica (§15.3). */
  versione: z.number().int(),
  mappa: MappaPartita,
  personaggi: z.array(Personaggio),
  partecipanti: z.array(Partecipante),
  /** Solo per il Master della partita. */
  inviti: z.array(Invito).optional(),
  /** Solo per il Master: tutte le zone, scoperte e no (RF-21, RF-22). */
  zone: z.array(ZonaPartita).optional(),
});
export type DettaglioPartita = z.infer<typeof DettaglioPartita>;
