<script lang="ts">
  import { conPunti } from '#lib/testo.ts';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { api, ErroreApi } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import { NOMI_RUOLO } from '#lib/partita/caricamento.ts';
  import Pedina from '#lib/partita/Pedina.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const { partita, personaggi, partecipanti } = $derived(data.dettaglio);
  const nomeDi = (id: number | null) => partecipanti.find((p) => p.utenteId === id)?.nome;
  let errore = $state<string | null>(null);

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

  {#if errore}<Avviso>{errore}</Avviso>{/if}

  <p class="tavolo">
    Il tavolo di gioco (mappa, pedine, dadi) arriverà con i prossimi aggiornamenti.
    {#if partita.mioRuolo === 'osservatore'}Partecipi come osservatore: potrai guardare, non
      giocare.{/if}
  </p>

  <div class="colonne">
    <section aria-labelledby="pg">
      <h2 id="pg">Personaggi</h2>
      {#if personaggi.length}
        <ul class="elenco">
          {#each personaggi as pg (pg.id)}
            <li class:mio={pg.utenteId === data.utente.id}>
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

    <section aria-labelledby="gruppo">
      <h2 id="gruppo">Al tavolo</h2>
      <ul class="elenco">
        <li>
          <span><strong>{partita.master.nome}</strong> <span class="etichetta">Master</span></span>
        </li>
        {#each partecipanti as p (p.utenteId)}
          <li>
            <span>
              <strong>{p.nome}</strong>
              <span class="etichetta">{NOMI_RUOLO[p.ruolo]}</span>
              {#if p.utenteId === data.utente.id}<span class="tenue">(tu)</span>{/if}
            </span>
          </li>
        {/each}
      </ul>
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
    </section>
  </div>
</main>

<style>
  main {
    max-width: 60rem;
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
  .tavolo {
    background: var(--superficie);
    border: 1px dashed var(--bordo);
    border-radius: 0.75rem;
    padding: 1rem 1.5rem;
  }
  .colonne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.5rem;
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
    border-color: #c9a227;
    box-shadow: 0 0 0 1px #c9a227;
  }
  .giocatore {
    display: block;
    font-size: 0.9rem;
  }
  .etichetta {
    font-size: 0.8rem;
    padding: 0.05rem 0.5rem;
    border-radius: 1rem;
    border: 1px solid var(--bordo);
    margin-left: 0.25rem;
  }
</style>
