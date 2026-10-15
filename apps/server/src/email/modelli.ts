import type { Email } from './postino.ts';

export function emailRecuperoPassword(a: string, nome: string, link: string): Email {
  return {
    a,
    oggetto: 'Reimposta la password del Tavolo virtuale',
    testo: `Ciao ${nome},

hai chiesto di reimpostare la password del Tavolo virtuale.
Apri questo link entro un'ora per sceglierne una nuova:

${link}

Se la richiesta non è partita da te, ignora questa email: la password resta quella di prima.
`,
  };
}

export function emailPrimoAccessoMaster(a: string, nome: string, link: string): Email {
  return {
    a,
    oggetto: 'Il tuo account Master sul Tavolo virtuale',
    testo: `Ciao ${nome},

è stato creato per te un account Master sul Tavolo virtuale.
Apri questo link entro 7 giorni per scegliere la password:

${link}
`,
  };
}

export function emailInvito(
  a: string,
  dati: { master: string; partita: string; ruolo: string; link: string },
): Email {
  return {
    a,
    oggetto: `${dati.master} ti invita a "${dati.partita}"`,
    testo: `Ciao,

${dati.master} ti invita a partecipare alla partita "${dati.partita}" sul Tavolo virtuale,
come ${dati.ruolo === 'giocatore' ? 'giocatore' : 'osservatore (sola lettura)'}.

Apri questo link entro 7 giorni per unirti. Se non hai ancora un account, potrai
crearlo con questa email (${a}):

${dati.link}
`,
  };
}
