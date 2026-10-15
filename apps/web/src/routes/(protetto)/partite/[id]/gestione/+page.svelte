<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import SezioneImpostazioni from '#lib/partita/SezioneImpostazioni.svelte';
  import SezioneInviti from '#lib/partita/SezioneInviti.svelte';
  import SezionePartecipanti from '#lib/partita/SezionePartecipanti.svelte';
  import SezionePersonaggi from '#lib/partita/SezionePersonaggi.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const dettaglio = $derived(data.dettaglio);
  const aggiorna = () => invalidate('app:partita');
</script>

<svelte:head><title>Gestisci {dettaglio.partita.titolo} · Tavolo virtuale</title></svelte:head>

<main>
  <p><a href={resolve(`partite/${dettaglio.partita.id}`)}>← {dettaglio.partita.titolo}</a></p>
  <h1>Gestisci la partita</h1>

  <div class="sezioni">
    <div class="scheda"><SezionePersonaggi {dettaglio} {aggiorna} /></div>
    <div class="scheda"><SezioneInviti {dettaglio} {aggiorna} /></div>
    <div class="scheda"><SezionePartecipanti {dettaglio} {aggiorna} /></div>
    <div class="scheda"><SezioneImpostazioni {dettaglio} {aggiorna} /></div>
  </div>
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
