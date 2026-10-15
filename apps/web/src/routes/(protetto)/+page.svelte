<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const utente = $derived(data.utente);
</script>

<svelte:head><title>Le mie partite · Tavolo virtuale</title></svelte:head>

<main>
  <h1>Ciao {utente.nome}</h1>
  <section class="vuoto">
    <h2>Le mie partite</h2>
    <p>
      Qui troverai le partite a cui partecipi{utente.ruolo === 'ROLE_MASTER'
        ? ' e quelle che conduci'
        : ''}.
    </p>
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
  .vuoto {
    background: var(--superficie);
    border: 1px dashed var(--bordo);
    border-radius: 0.75rem;
    padding: 1rem 1.5rem;
  }
</style>
