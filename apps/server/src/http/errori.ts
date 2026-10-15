import type { RispostaErrore } from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

/** Errore con codice HTTP e messaggio in italiano destinato all'utente. */
export class ErroreHttp extends Error {
  readonly codice: number;
  readonly campi: Record<string, string> | undefined;

  constructor(codice: number, messaggio: string, campi?: Record<string, string>) {
    super(messaggio);
    this.codice = codice;
    this.campi = campi;
  }
}

/** Valida un corpo di richiesta; se non è valido lancia un 400 con l'errore di ogni campo. */
export function valida<S extends z.ZodType>(schema: S, dati: unknown): z.output<S> {
  const risultato = schema.safeParse(dati);
  if (risultato.success) return risultato.data;

  const campi: Record<string, string> = {};
  for (const problema of risultato.error.issues) {
    const campo = problema.path.join('.') || '_';
    campi[campo] ??= problema.message;
  }
  throw new ErroreHttp(400, 'Controlla i dati inseriti', campi);
}

/** Trasforma ogni errore in una risposta `RispostaErrore`, senza esporre dettagli interni. */
export function gestoreErrori(app: FastifyInstance): void {
  app.setErrorHandler((errore, richiesta, risposta) => {
    if (errore instanceof ErroreHttp) {
      const corpo: RispostaErrore = { errore: errore.message };
      if (errore.campi) corpo.campi = errore.campi;
      return risposta.code(errore.codice).send(corpo);
    }
    const codice =
      typeof errore === 'object' && errore !== null && 'statusCode' in errore
        ? Number(errore.statusCode)
        : 500;
    if (codice === 429) {
      return risposta.code(429).send({ errore: 'Troppi tentativi: riprova tra qualche minuto' });
    }
    if (codice >= 400 && codice < 500) {
      return risposta.code(codice).send({ errore: 'Richiesta non valida' });
    }
    richiesta.log.error(errore);
    return risposta.code(500).send({ errore: 'Errore interno del server' });
  });
}
