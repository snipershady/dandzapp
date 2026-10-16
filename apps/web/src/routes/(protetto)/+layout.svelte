<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import { api } from '#lib/api.ts';
  import InterruttoreTema from '#lib/componenti/InterruttoreTema.svelte';
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps & { children: Snippet } = $props();
  const utente = $derived(data.utente);

  async function esci(): Promise<void> {
    await api('/api/auth/uscita', { metodo: 'POST' }).catch(() => undefined);
    await goto(resolve('accedi'), { replaceState: true, invalidateAll: true });
  }
</script>

<header class="barra">
  <a class="marchio" href={resolve('')}>Tavolo virtuale</a>
  <nav aria-label="Principale">
    <a href={resolve('')} aria-current={page.url.pathname === '/' ? 'page' : undefined}>Partite</a>
    {#if utente.ruolo === 'ROLE_MASTER'}
      <a
        href={resolve('amministrazione')}
        aria-current={page.url.pathname === '/amministrazione' ? 'page' : undefined}>Utenti</a
      >
    {/if}
  </nav>
  <span class="chi">
    {utente.nome}
    <span class="ruolo">{utente.ruolo === 'ROLE_MASTER' ? 'Master' : 'Giocatore'}</span>
  </span>
  <InterruttoreTema />
  <button type="button" onclick={esci}>Esci</button>
</header>

{@render children()}

<style>
  .barra {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.75rem 1rem;
    background: var(--superficie);
    border-bottom: 1px solid var(--bordo);
  }
  .marchio {
    font-family: var(--font-titoli);
    color: var(--accento);
    font-size: 1.25rem;
    text-decoration: none;
  }
  nav {
    display: flex;
    gap: 1rem;
    margin-right: auto;
  }
  nav a {
    color: var(--testo);
    text-decoration: none;
    padding: 0.25rem 0;
    border-bottom: 2px solid transparent;
  }
  nav a[aria-current='page'] {
    border-bottom-color: var(--accento);
    font-weight: 700;
  }
  .ruolo {
    font-size: 0.8rem;
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    background: var(--accento);
    color: var(--su-accento);
    margin-left: 0.35rem;
  }
</style>
