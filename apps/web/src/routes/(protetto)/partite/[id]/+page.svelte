<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount, untrack } from 'svelte';
  import { api, ErroreApi } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import Selettore from '#lib/componenti/Selettore.svelte';
  import Pedina from '#lib/partita/Pedina.svelte';
  import AlTavolo from '#lib/tavolo/AlTavolo.svelte';
  import { Collegamento } from '#lib/tavolo/collegamento.svelte.ts';
  import Mappa from '#lib/tavolo/Mappa.svelte';
  import MasterLegge from '#lib/tavolo/MasterLegge.svelte';
  import PannelloNarrazione from '#lib/tavolo/PannelloNarrazione.svelte';
  import Dadi from '#lib/tavolo/Dadi.svelte';
  import PannelloMostri from '#lib/tavolo/PannelloMostri.svelte';
  import PannelloZone from '#lib/tavolo/PannelloZone.svelte';
  import RigaStato from '#lib/tavolo/RigaStato.svelte';
  import Storico from '#lib/tavolo/Storico.svelte';
  import { conPunti } from '#lib/testo.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Lo stato arriva dal caricamento della pagina e poi resta allineato in tempo reale.
  const collegamento = new Collegamento(untrack(() => data.dettaglio));
  onMount(() => {
    collegamento.avvia();
    return () => collegamento.ferma();
  });

  const {
    partita,
    mappa,
    personaggi,
    partecipanti,
    zone,
    mostri,
    tiri,
    tipiMostro,
    narrazione,
    narrazioni,
  } = $derived(collegamento.dettaglio);
  const nomeDi = (id: number | null) => partecipanti.find((p) => p.utenteId === id)?.nome;
  let errore = $state<string | null>(null);

  /** "Giochi come" (RF-03): il Master è sempre "Master". */
  const mioPersonaggioId = $derived(
    partecipanti.find((p) => p.utenteId === data.utente.id)?.personaggioId ?? null,
  );
  const puoMuovere = $derived(partita.mioRuolo !== 'osservatore' && partita.stato === 'attiva');
  /** Perché non si possono tirare i dadi: un giocatore deve aver scelto il suo PG. */
  const bloccoDadi = $derived(
    partita.stato !== 'attiva'
      ? 'La partita è archiviata: non si tirano dadi.'
      : partita.mioRuolo === 'giocatore' && mioPersonaggioId === null
        ? 'Scegli il tuo personaggio in "Giochi come" per tirare i dadi.'
        : null,
  );

  async function giochiCome(evento: Event): Promise<void> {
    const valore = (evento.currentTarget as HTMLSelectElement).value;
    try {
      await api(`/api/partite/${partita.id}/io`, {
        metodo: 'PUT',
        corpo: { personaggioId: valore ? Number(valore) : null },
      });
      errore = null;
      await collegamento.aggiornaOra();
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Operazione non riuscita';
    }
  }

  async function riportaPedine(): Promise<void> {
    const r = await collegamento.riportaPedine();
    errore = r.ok ? null : r.errore;
  }

  async function lascia(): Promise<void> {
    try {
      await api(`/api/partite/${partita.id}/partecipanti/${data.utente.id}`, { metodo: 'DELETE' });
      await goto(resolve(''), { invalidateAll: true });
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Operazione non riuscita';
    }
  }
</script>

<svelte:head><title>{partita.titolo} · Tavolo virtuale</title></svelte:head>

<main>
  <p><a href={resolve('')}>← Le mie partite</a></p>

  {#if collegamento.chiusura}
    <Avviso>{collegamento.chiusura}.</Avviso>
    <p><a href={resolve('')}>Torna alle tue partite</a></p>
  {:else}
    <header>
      <div>
        <h1>{partita.titolo}</h1>
        <p class="tenue">
          {conPunti(
            partita.avventura.titolo,
            partita.avventura.sottotitolo,
            `Master: ${partita.master.nome}`,
            partita.stato === 'archiviata' && 'archiviata',
          )}
        </p>
      </div>
      {#if partita.mioRuolo === 'master'}
        <a class="pulsante" href={resolve(`partite/${partita.id}/gestione`)}>Gestisci la partita</a>
      {/if}
    </header>

    {#if partita.mioRuolo === 'osservatore'}
      <!-- RF-04: chi non può giocare lo sa subito, e sa cosa fare. -->
      <div class="sola-lettura" role="alert">
        <strong>Sola lettura.</strong> Partecipi come osservatore: puoi guardare il tavolo, ma non
        tirare i dadi né muovere le pedine. Se devi giocare, chiedi a {partita.master.nome} di renderti
        giocatore.
      </div>
    {/if}
    {#if errore}<Avviso>{errore}</Avviso>{/if}

    <!-- Sugli schermi grandi: mappa a sinistra, dadi e storico a destra (RNF-02). -->
    <div class="piano">
      <div class="sinistra">
        <MasterLegge {narrazione} />

        <section class="tavolo" aria-label="Tavolo">
          <div class="comandi">
            {#if partita.mioRuolo === 'master'}
              <p class="come">Giochi come: <strong>Master</strong></p>
              <PulsanteConferma
                testo="Riporta le pedine all'ingresso"
                domanda="Riportare tutte le pedine ai posti di partenza?"
                conferma="Riporta"
                disabled={partita.stato !== 'attiva'}
                onconferma={riportaPedine}
              />
            {:else if partita.mioRuolo === 'giocatore'}
              <Selettore
                etichetta="Giochi come"
                value={mioPersonaggioId ?? ''}
                onchange={giochiCome}
              >
                <option value="">— nessun personaggio —</option>
                {#each personaggi as pg (pg.id)}
                  <option value={pg.id}>{pg.nome}</option>
                {/each}
              </Selettore>
            {/if}
          </div>
          <Mappa
            partitaId={partita.id}
            {mappa}
            {personaggi}
            {zone}
            {mostri}
            puoMuovereMostri={partita.mioRuolo === 'master' && partita.stato === 'attiva'}
            spostaMostro={(c) => collegamento.spostaMostro(c)}
            {mioPersonaggioId}
            {puoMuovere}
            sposta={(c) => collegamento.spostaPedina(c)}
            onerrore={(m) => (errore = m)}
          />
        </section>

        <RigaStato {collegamento} ruolo={partita.mioRuolo} />
      </div>

      <div class="gioco">
        {#if partita.mioRuolo !== 'osservatore'}
          <Dadi
            master={partita.mioRuolo === 'master'}
            blocco={bloccoDadi}
            tira={(c) => collegamento.tira(c)}
          />
        {/if}
        <Storico
          {tiri}
          master={partita.mioRuolo === 'master'}
          svuota={() => collegamento.svuotaTiri()}
          onerrore={(m) => (errore = m)}
        />
      </div>
    </div>

    <div class="colonne">
      {#if narrazioni}
        <PannelloNarrazione
          corrente={narrazione}
          storico={narrazioni}
          disabilitato={partita.stato !== 'attiva'}
          pubblica={(t) => collegamento.pubblicaNarrazione(t)}
          ripubblica={(id) => collegamento.ripubblicaNarrazione(id)}
          elimina={(id) => collegamento.eliminaNarrazione(id)}
          nascondi={() => collegamento.nascondiNarrazione()}
          onerrore={(m) => (errore = m)}
        />
      {/if}
      {#if zone}
        <PannelloZone
          {zone}
          disabilitato={partita.stato !== 'attiva'}
          imposta={(c) => collegamento.impostaZona(c)}
          onerrore={(m) => (errore = m)}
        />
        <PannelloMostri
          {mostri}
          tipi={tipiMostro ?? []}
          {zone}
          disabilitato={partita.stato !== 'attiva'}
          aggiungi={(c) => collegamento.aggiungiMostri(c)}
          togli={(id) => collegamento.togliMostro(id)}
          togliTutti={() => collegamento.togliTuttiIMostri()}
          onerrore={(m) => (errore = m)}
        />
      {/if}
      <section aria-labelledby="pg">
        <!-- Legenda delle pedine (RF-35). -->
        <h2 id="pg">Personaggi</h2>
        {#if personaggi.length}
          <ul class="elenco">
            {#each personaggi as pg (pg.id)}
              <li class:mio={pg.id === mioPersonaggioId}>
                <Pedina colore={pg.colore} sigla={pg.sigla} nome={pg.nome} />
                <span>
                  <span class="riga"
                    ><strong>{pg.nome}</strong><span class="tenue"
                      >{pg.classe ? ` · ${pg.classe}` : ''}</span
                    ></span
                  >
                  <span class="tenue giocatore">{nomeDi(pg.utenteId) ?? 'nessun giocatore'}</span>
                </span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="tenue">Il Master non ha ancora creato i personaggi.</p>
        {/if}
      </section>

      <div>
        <AlTavolo presenti={collegamento.presenti} {personaggi} io={data.utente.id} />
        {#if partita.mioRuolo !== 'master'}
          <p>
            <PulsanteConferma
              testo="Lascia la partita"
              domanda="Vuoi davvero lasciare la partita?"
              conferma="Lascia"
              pericolosa
              onconferma={lascia}
            />
          </p>
        {/if}
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 84rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }
  h1 {
    font-family: var(--font-titoli);
    margin: 0;
  }
  .tenue {
    color: var(--testo-tenue);
  }
  .pulsante {
    background: var(--accento);
    color: var(--su-accento);
    padding: 0.45rem 1rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: 700;
  }
  .sola-lettura {
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    border: 2px solid var(--errore);
    background: var(--errore-sfondo);
    color: var(--errore);
    border-radius: 0.5rem;
  }
  .tavolo {
    margin-top: 1rem;
  }
  .comandi {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 0 1rem;
  }
  .come {
    margin: 0 0 1rem;
  }
  .gioco {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
    align-items: start;
  }
  /* Abbastanza spazio: dadi e storico accanto alla mappa, così si tira senza scorrere. */
  @media (min-width: 1100px) {
    .piano {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22rem;
      gap: 1.5rem;
      align-items: start;
    }
    .piano .gioco {
      grid-template-columns: 1fr;
      position: sticky;
      top: 1rem;
    }
  }
  .colonne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
  }
  .elenco {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  .elenco li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  .elenco li.mio {
    border-color: var(--oro);
    box-shadow: 0 0 0 1px var(--oro);
  }
  .giocatore {
    display: block;
    font-size: 0.9rem;
  }
</style>
