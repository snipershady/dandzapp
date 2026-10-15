<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { api } from '#lib/api.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const utente = $derived(data.utente);

  async function esci(): Promise<void> {
    await api('/api/auth/uscita', { metodo: 'POST' }).catch(() => undefined);
    await goto(resolve('accedi'), { replaceState: true, invalidateAll: true });
  }
</script>

<svelte:head><title>Le mie partite · Tavolo virtuale</title></svelte:head>

<header class="barra">
  <span class="marchio">Tavolo virtuale</span>
  <span class="chi">
    {utente.nome}
    <span class="ruolo">{utente.ruolo === 'ROLE_MASTER' ? 'Master' : 'Giocatore'}</span>
  </span>
  <button type="button" onclick={esci}>Esci</button>
</header>

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
  .barra {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--superficie);
    border-bottom: 1px solid var(--bordo);
  }
  .marchio {
    font-family: var(--font-titoli);
    color: var(--accento);
    font-size: 1.25rem;
    margin-right: auto;
  }
  .ruolo {
    font-size: 0.8rem;
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--accento);
    color: var(--su-accento);
    margin-left: 0.35rem;
  }
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
