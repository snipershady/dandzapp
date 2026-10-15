<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<main class="pubblico">
  <header>
    <h1>Tavolo virtuale</h1>
    <p>Dungeons &amp; Dragons BECMI · Mystara</p>
  </header>
  <div class="scheda">
    {@render children()}
  </div>
</main>

<style>
  .pubblico {
    max-width: 26rem;
    margin: 0 auto;
    padding: 2.5rem 1rem;
  }
  header {
    text-align: center;
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
    font-family: var(--font-titoli);
    color: var(--accento);
    font-size: 2rem;
  }
  header p {
    margin: 0.25rem 0 0;
    color: var(--testo-tenue);
  }
  .scheda {
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.75rem;
    padding: 1.5rem;
  }
</style>
