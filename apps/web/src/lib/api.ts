import { RispostaErrore } from '@dandzapp/shared';
import type { z } from 'zod';

/** Errore restituito dall'API, con il messaggio da mostrare e gli errori per campo. */
export class ErroreApi extends Error {
  readonly stato: number;
  readonly campi: Record<string, string>;

  constructor(stato: number, messaggio: string, campi: Record<string, string> = {}) {
    super(messaggio);
    this.stato = stato;
    this.campi = campi;
  }
}

type Opzioni<S extends z.ZodType | undefined> = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  schema?: S;
  fetch?: typeof fetch;
};

/** Chiamata all'API del server; valida la risposta con lo schema, se indicato. */
export async function api<S extends z.ZodType | undefined = undefined>(
  url: string,
  { metodo = 'GET', corpo, schema, fetch: f = fetch }: Opzioni<S> = {},
): Promise<S extends z.ZodType ? z.output<S> : void> {
  let risposta: Response;
  try {
    risposta = await f(url, {
      method: metodo,
      headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroreApi(0, 'Server non raggiungibile: controlla la connessione e riprova');
  }

  const testo = await risposta.text();
  const dati: unknown = testo ? JSON.parse(testo) : undefined;
  if (!risposta.ok) {
    const errore = RispostaErrore.safeParse(dati);
    throw errore.success
      ? new ErroreApi(risposta.status, errore.data.errore, errore.data.campi)
      : new ErroreApi(risposta.status, 'Errore imprevisto del server');
  }
  return (schema ? schema.parse(dati) : undefined) as S extends z.ZodType ? z.output<S> : void;
}
