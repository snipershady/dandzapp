import { z } from 'zod';

/** Risposta di `GET /api/salute`: stato del server e del database. */
export const RispostaSalute = z.object({
  stato: z.enum(['ok', 'degradato']),
  database: z.enum(['ok', 'non raggiungibile']),
  versione: z.string(),
});

export type RispostaSalute = z.infer<typeof RispostaSalute>;
