import type { Db } from '../db/database.ts';

/**
 * Esportazione dello stato di una partita in JSON (RF-95), solo per il suo Master.
 * Contiene anche le email dei partecipanti (decisione del 16/10/2026: servono per
 * ricreare gli inviti), ma mai dati di accesso: niente hash di password, token di
 * sessione o di invito. Il backup completo resta quello del database MySQL.
 */
export async function backupPartita(db: Db, partitaId: number, ora: Date) {
  const partita = await db
    .selectFrom('partite')
    .innerJoin('utenti as master', 'master.id', 'partite.master_id')
    .innerJoin('avventure', 'avventure.id', 'partite.avventura_id')
    .select([
      'partite.id',
      'partite.titolo',
      'partite.stato',
      'partite.versione',
      'partite.narrazione_id',
      'partite.creata_il',
      'partite.aggiornata_il',
      'master.nome as master_nome',
      'master.email as master_email',
      'avventure.slug as avventura_slug',
      'avventure.titolo as avventura_titolo',
    ])
    .where('partite.id', '=', partitaId)
    .executeTakeFirstOrThrow();

  const [personaggi, partecipanti, inviti, zone, mostri, sigle, narrazioni, tiri] =
    await Promise.all([
      db
        .selectFrom('personaggi')
        .leftJoin('utenti', 'utenti.id', 'personaggi.utente_id')
        .select([
          'personaggi.id',
          'personaggi.nome',
          'personaggi.classe',
          'personaggi.sigla',
          'personaggi.colore',
          'personaggi.posto',
          'personaggi.x',
          'personaggi.y',
          'utenti.email as giocatore',
        ])
        .where('personaggi.partita_id', '=', partitaId)
        .orderBy('personaggi.posto')
        .execute(),
      db
        .selectFrom('partecipazioni')
        .innerJoin('utenti', 'utenti.id', 'partecipazioni.utente_id')
        .select([
          'utenti.nome',
          'utenti.email',
          'partecipazioni.ruolo',
          'partecipazioni.personaggio_id as personaggioId',
          'partecipazioni.creata_il as dal',
        ])
        .where('partecipazioni.partita_id', '=', partitaId)
        .orderBy('utenti.nome')
        .execute(),
      db
        .selectFrom('inviti')
        .select(['email', 'ruolo', 'personaggio_id as personaggioId', 'scade_il as scadeIl'])
        .where('partita_id', '=', partitaId)
        .where('accettato_il', 'is', null)
        .orderBy('email')
        .execute(),
      db
        .selectFrom('zone_scoperte')
        .select('zona_id')
        .where('partita_id', '=', partitaId)
        .orderBy('zona_id')
        .execute(),
      db
        .selectFrom('mostri')
        .select(['id', 'nome', 'sigla', 'x', 'y'])
        .where('partita_id', '=', partitaId)
        .orderBy('id')
        .execute(),
      db
        .selectFrom('mostri_sigle')
        .select(['prefisso', 'ultimo'])
        .where('partita_id', '=', partitaId)
        .orderBy('prefisso')
        .execute(),
      db
        .selectFrom('narrazioni')
        .select(['id', 'testo', 'creata_il as creataIl', 'pubblicata_il as pubblicataIl'])
        .where('partita_id', '=', partitaId)
        .orderBy('id')
        .execute(),
      db
        .selectFrom('tiri')
        .innerJoin('utenti', 'utenti.id', 'tiri.utente_id')
        .select([
          'tiri.id',
          'tiri.creato_il as creatoIl',
          'utenti.nome as utente',
          'tiri.personaggio_nome as personaggio',
          'tiri.motivo',
          'tiri.n_dadi as numero',
          'tiri.facce',
          'tiri.modificatore',
          'tiri.risultati',
          'tiri.totale',
          'tiri.nascosto',
        ])
        .where('tiri.partita_id', '=', partitaId)
        .orderBy('tiri.creato_il')
        .orderBy('tiri.id')
        .execute(),
    ]);

  return {
    formato: 1,
    esportatoIl: ora.toISOString(),
    partita: {
      id: partita.id,
      titolo: partita.titolo,
      stato: partita.stato,
      versione: Number(partita.versione),
      creataIl: partita.creata_il.toISOString(),
      aggiornataIl: partita.aggiornata_il.toISOString(),
      master: { nome: partita.master_nome, email: partita.master_email },
      avventura: { id: partita.avventura_slug, titolo: partita.avventura_titolo },
    },
    personaggi,
    partecipanti: partecipanti.map((p) => ({ ...p, dal: p.dal.toISOString() })),
    invitiInSospeso: inviti.map((i) => ({ ...i, scadeIl: i.scadeIl.toISOString() })),
    zoneScoperte: zone.map((z) => z.zona_id),
    mostri,
    sigleMostri: sigle,
    narrazione: {
      mostrataOra: partita.narrazione_id,
      testi: narrazioni.map((n) => ({
        ...n,
        creataIl: n.creataIl.toISOString(),
        pubblicataIl: n.pubblicataIl.toISOString(),
      })),
    },
    tiri: tiri.map((t) => ({
      ...t,
      creatoIl: t.creatoIl.toISOString(),
      nascosto: Boolean(t.nascosto),
    })),
  };
}
