<script lang="ts">
  import { conPunti } from '#lib/testo.ts';
  import { resolve } from '$app/paths';
  import type { RiepilogoPartita } from '@dandzapp/shared';
  import { NOMI_RUOLO } from '#lib/partita/caricamento.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const utente = $derived(data.utente);
  const { conduco, partecipo } = $derived(data.partite);
  const master = $derived(utente.ruolo === 'ROLE_MASTER');
</script>

<svelte:head><title>Le mie partite · Tavolo virtuale</title></svelte:head>

{#snippet scheda(p: RiepilogoPartita)}
  <li>
    <a class="scheda" class:archiviata={p.stato === 'archiviata'} href={resolve(`partite/${p.id}`)}>
      <strong class="titolo">{p.titolo}</strong>
      <span class="avventura">{conPunti(p.avventura.titolo, p.avventura.sottotitolo)}</span>
      <span class="dettagli">
        {conPunti(
          p.mioRuolo !== 'master' && `Master: ${p.master.nome}`,
          `${p.numeroPartecipanti} ${p.numeroPartecipanti === 1 ? 'partecipante' : 'partecipanti'}`,
          p.mioRuolo !== 'master' && NOMI_RUOLO[p.mioRuolo],
          p.stato === 'archiviata' && 'archiviata',
        )}
      </span>
    </a>
  </li>
{/snippet}

<main>
  <h1>Le mie partite</h1>

  {#if master}
    <section aria-labelledby="conduco">
      <div class="intestazione">
        <h2 id="conduco">Partite che conduci</h2>
        <a class="pulsante" href={resolve('partite/nuova')}>Nuova partita</a>
      </div>
      {#if conduco.length}
        <ul class="griglia">
          {#each conduco as p (p.id)}{@render scheda(p)}{/each}
        </ul>
      {:else}
        <p class="vuoto">Non conduci ancora nessuna partita: creane una e invita il gruppo.</p>
      {/if}
    </section>
  {/if}

  <section aria-labelledby="partecipo">
    <h2 id="partecipo">{master ? 'Partite a cui partecipi' : 'Le tue partite'}</h2>
    {#if partecipo.length}
      <ul class="griglia">
        {#each partecipo as p (p.id)}{@render scheda(p)}{/each}
      </ul>
    {:else}
      <p class="vuoto">
        Non partecipi ancora a nessuna partita. Quando un Master ti invita, ricevi un'email con il
        link per unirti.
      </p>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }
  h1 {
    font-family: var(--font-titoli);
  }
  section {
    margin-bottom: 2rem;
  }
  .intestazione {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .pulsante {
    background: var(--accento);
    color: var(--su-accento);
    padding: 0.45rem 1rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: 700;
  }
  .griglia {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: 0.75rem;
  }
  .scheda {
    display: grid;
    gap: 0.2rem;
    height: 100%;
    box-sizing: border-box;
    padding: 1rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.75rem;
    color: var(--testo);
    text-decoration: none;
  }
  .scheda:hover {
    border-color: var(--accento);
  }
  .scheda.archiviata {
    opacity: 0.7;
  }
  .titolo {
    font-family: var(--font-titoli);
    font-size: 1.2rem;
    color: var(--accento);
  }
  .avventura,
  .dettagli {
    color: var(--testo-tenue);
    font-size: 0.95rem;
  }
  .vuoto {
    background: var(--superficie);
    border: 1px dashed var(--bordo);
    border-radius: 0.75rem;
    padding: 1rem 1.5rem;
  }
</style>
