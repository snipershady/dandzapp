<script lang="ts">
  import { RispostaSalute } from '@dandzapp/shared';

  type Stato =
    { tipo: 'caricamento' } | { tipo: 'pronto'; salute: RispostaSalute } | { tipo: 'errore' };

  let stato: Stato = $state({ tipo: 'caricamento' });

  async function controllaServer(): Promise<void> {
    try {
      const risposta = await fetch('/api/salute');
      stato = { tipo: 'pronto', salute: RispostaSalute.parse(await risposta.json()) };
    } catch {
      stato = { tipo: 'errore' };
    }
  }

  $effect(() => {
    void controllaServer();
  });
</script>

<main>
  <h1>Tavolo virtuale</h1>
  <p>Dungeons &amp; Dragons BECMI · Mystara</p>

  <p class="stato" role="status">
    {#if stato.tipo === 'caricamento'}
      Collegamento al server…
    {:else if stato.tipo === 'errore'}
      <span class="ko">Server non raggiungibile.</span>
    {:else if stato.salute.stato === 'ok'}
      <span class="ok">Server collegato</span> · versione {stato.salute.versione}
    {:else}
      <span class="ko">Server collegato, database non raggiungibile.</span>
    {/if}
  </p>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  h1 {
    color: var(--lapislazzuli);
    margin-bottom: 0;
  }
  .stato {
    padding: 0.75rem 1rem;
    background: var(--papiro);
    border-radius: 0.5rem;
  }
  .ok {
    color: var(--verde);
    font-weight: 600;
  }
  .ko {
    color: var(--corniola);
    font-weight: 600;
  }
</style>
