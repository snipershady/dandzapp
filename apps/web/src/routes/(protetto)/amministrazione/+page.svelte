<script lang="ts">
  import {
    RispostaElencoUtenti,
    RispostaUtenteAmministrato,
    type CorpoModificaUtente,
    type UtenteAmministrato,
  } from '@dandzapp/shared';
  import { api, ErroreApi } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  type Azione = { utente: UtenteAmministrato; modifiche: CorpoModificaUtente; testo: string };

  let cerca = $state('');
  let utenti = $state<UtenteAmministrato[]>([]);
  let totale = $state(0);
  let caricamento = $state(true);
  let errore = $state<string | null>(null);
  let conferma = $state<Azione | null>(null);
  let inCorso = $state(false);

  // Ricerca con un breve ritardo, per non interrogare il server a ogni tasto.
  $effect(() => {
    const testo = cerca.trim();
    const timer = setTimeout(() => void carica(testo), testo ? 250 : 0);
    return () => clearTimeout(timer);
  });

  async function carica(testo: string): Promise<void> {
    caricamento = true;
    try {
      const query = testo ? `?cerca=${encodeURIComponent(testo)}` : '';
      const risposta = await api(`/api/amministrazione/utenti${query}`, {
        schema: RispostaElencoUtenti,
      });
      utenti = risposta.utenti;
      totale = risposta.totale;
      errore = null;
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Impossibile caricare gli utenti';
    } finally {
      caricamento = false;
    }
  }

  function azioni(u: UtenteAmministrato): Azione[] {
    return [
      u.ruolo === 'ROLE_PLAYER'
        ? { utente: u, modifiche: { ruolo: 'ROLE_MASTER' }, testo: 'Rendi Master' }
        : { utente: u, modifiche: { ruolo: 'ROLE_PLAYER' }, testo: 'Rendi giocatore' },
      u.attivo
        ? { utente: u, modifiche: { attivo: false }, testo: 'Disattiva' }
        : { utente: u, modifiche: { attivo: true }, testo: 'Riattiva' },
    ];
  }

  // Conferma nell'interfaccia, senza finestre del browser (RNF-09).
  async function esegui(azione: Azione): Promise<void> {
    inCorso = true;
    try {
      const { utente } = await api(`/api/amministrazione/utenti/${azione.utente.id}`, {
        metodo: 'PATCH',
        corpo: azione.modifiche,
        schema: RispostaUtenteAmministrato,
      });
      utenti = utenti.map((u) => (u.id === utente.id ? utente : u));
      errore = null;
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Modifica non riuscita';
    } finally {
      inCorso = false;
      conferma = null;
    }
  }

  const formatoData = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' });
</script>

<svelte:head><title>Utenti · Tavolo virtuale</title></svelte:head>

<main>
  <h1>Utenti</h1>
  <p class="intro">
    Promuovi a Master chi deve condurre partite. Un account disattivato non può più accedere e le
    sue sessioni aperte vengono chiuse.
  </p>

  <div class="ricerca">
    <label for="cerca">Cerca per nome o email</label>
    <input id="cerca" type="search" bind:value={cerca} autocomplete="off" />
  </div>

  {#if errore}<Avviso>{errore}</Avviso>{/if}

  <p class="conteggio" role="status">
    {#if caricamento}
      Caricamento…
    {:else if totale === 0}
      Nessun utente trovato.
    {:else if totale > utenti.length}
      Mostrati {utenti.length} utenti su {totale}: affina la ricerca.
    {:else}
      {totale} {totale === 1 ? 'utente' : 'utenti'}
    {/if}
  </p>

  <ul class="elenco">
    {#each utenti as u (u.id)}
      {@const tu = u.id === data.utente.id}
      <li class:disattivo={!u.attivo} aria-label={u.nome}>
        <div class="identita">
          <strong>{u.nome}</strong>
          <span class="email">{u.email}</span>
        </div>
        <div class="stato">
          <span class="etichetta" class:master={u.ruolo === 'ROLE_MASTER'}>
            {u.ruolo === 'ROLE_MASTER' ? 'Master' : 'Giocatore'}
          </span>
          {#if !u.attivo}<span class="etichetta spenta">Disattivato</span>{/if}
          {#if !u.haPassword}<span class="etichetta">Password da scegliere</span>{/if}
          <span class="data">dal {formatoData.format(new Date(u.creatoIl))}</span>
        </div>
        <div class="azioni">
          {#if tu}
            <span class="tu">Sei tu</span>
          {:else if conferma?.utente.id === u.id}
            <span class="domanda">{conferma.testo} {u.nome}?</span>
            <button
              type="button"
              class="conferma"
              disabled={inCorso}
              onclick={() => conferma && esegui(conferma)}>Conferma</button
            >
            <button type="button" disabled={inCorso} onclick={() => (conferma = null)}
              >Annulla</button
            >
          {:else}
            {#each azioni(u) as azione (azione.testo)}
              <button type="button" disabled={inCorso} onclick={() => (conferma = azione)}
                >{azione.testo}</button
              >
            {/each}
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</main>

<style>
  main {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }
  h1 {
    font-family: var(--font-titoli);
    margin-bottom: 0.25rem;
  }
  .intro,
  .conteggio {
    color: var(--testo-tenue);
  }
  .ricerca {
    display: grid;
    gap: 0.3rem;
    max-width: 24rem;
    margin: 1rem 0;
  }
  .ricerca label {
    font-weight: 600;
  }
  .ricerca input {
    font: inherit;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    background: var(--superficie);
    color: var(--testo);
  }
  .elenco {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.75rem 1rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.6rem;
  }
  li.disattivo .identita {
    opacity: 0.6;
  }
  .identita {
    display: grid;
    min-width: 0;
  }
  .email,
  .data {
    color: var(--testo-tenue);
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }
  .stato {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }
  .etichetta {
    font-size: 0.8rem;
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    border: 1px solid var(--bordo);
  }
  .etichetta.master {
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
  }
  .etichetta.spenta {
    color: var(--errore);
    border-color: var(--errore);
  }
  .azioni {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: flex-end;
    align-items: center;
  }
  .azioni button {
    padding: 0.35rem 0.75rem;
  }
  .conferma {
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
  }
  .domanda {
    font-weight: 600;
  }
  .tu {
    color: var(--testo-tenue);
    font-style: italic;
  }
  @media (max-width: 40rem) {
    li {
      grid-template-columns: 1fr;
    }
    .azioni {
      justify-content: flex-start;
    }
  }
</style>
