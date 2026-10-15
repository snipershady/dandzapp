<script lang="ts">
  import { resolve } from '$app/paths';
  import { onMount, untrack } from 'svelte';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import SezioneImpostazioni from '#lib/partita/SezioneImpostazioni.svelte';
  import SezioneInviti from '#lib/partita/SezioneInviti.svelte';
  import SezionePartecipanti from '#lib/partita/SezionePartecipanti.svelte';
  import SezionePersonaggi from '#lib/partita/SezionePersonaggi.svelte';
  import { Collegamento } from '#lib/tavolo/collegamento.svelte.ts';
  import RigaStato from '#lib/tavolo/RigaStato.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Anche la gestione resta allineata: chi accetta un invito compare subito.
  const collegamento = new Collegamento(untrack(() => data.dettaglio));
  onMount(() => {
    collegamento.avvia();
    return () => collegamento.ferma();
  });
  const dettaglio = $derived(collegamento.dettaglio);
  const aggiorna = () => collegamento.aggiornaOra();
</script>

<svelte:head><title>Gestisci {dettaglio.partita.titolo} · Tavolo virtuale</title></svelte:head>

<main>
  <p><a href={resolve(`partite/${dettaglio.partita.id}`)}>← {dettaglio.partita.titolo}</a></p>
  <h1>Gestisci la partita</h1>

  {#if collegamento.chiusura}
    <Avviso>{collegamento.chiusura}.</Avviso>
  {:else}
    <div class="sezioni">
      <div class="scheda"><SezionePersonaggi {dettaglio} {aggiorna} /></div>
      <div class="scheda"><SezioneInviti {dettaglio} {aggiorna} /></div>
      <div class="scheda"><SezionePartecipanti {dettaglio} {aggiorna} /></div>
      <div class="scheda"><SezioneImpostazioni {dettaglio} {aggiorna} /></div>
      <RigaStato {collegamento} ruolo="master" />
    </div>
  {/if}
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
  .sezioni {
    display: grid;
    gap: 1rem;
  }
  .scheda {
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
  }
</style>
