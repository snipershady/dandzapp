<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  const titoli: Record<number, string> = {
    403: 'Accesso non consentito',
    404: 'Pagina non trovata',
  };
  const titolo = $derived(titoli[page.status] ?? 'Qualcosa è andato storto');
  const dettaglio = $derived(
    page.status === 404 ? 'Questa pagina non esiste (o non ancora).' : page.error?.message,
  );
</script>

<svelte:head><title>{titolo} · Tavolo virtuale</title></svelte:head>

<main>
  <h1>{titolo}</h1>
  {#if dettaglio}<p>{dettaglio}</p>{/if}
  <p><a href={resolve('')}>Torna alle partite</a></p>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: 3rem 1rem;
    text-align: center;
  }
  h1 {
    font-family: var(--font-titoli);
    color: var(--accento);
  }
</style>
