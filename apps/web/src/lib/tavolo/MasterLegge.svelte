<script lang="ts">
  import type { Narrazione } from '@dandzapp/shared';

  /**
   * Riquadro "Il Master legge" sopra la mappa (RF-70). Il testo è mostrato come testo,
   * mai come HTML (RNF-06), con gli a capo del Master.
   */
  let { narrazione }: { narrazione: Narrazione | null } = $props();
</script>

<!-- Sempre presente (anche vuoto), così i lettori di schermo annunciano i testi nuovi. -->
<div class="contenitore" aria-live="polite">
  {#if narrazione}
    <section class="legge" aria-labelledby="legge">
      <h2 id="legge">Il Master legge</h2>
      <p>{narrazione.testo}</p>
    </section>
  {/if}
</div>

<style>
  .legge {
    margin: 1rem 0;
    padding: 0.9rem 1.2rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-left: 4px solid var(--accento);
    border-radius: 0.5rem;
  }
  h2 {
    margin: 0 0 0.4rem;
    font-family: var(--font-titoli);
    font-size: 1rem;
    color: var(--testo-tenue);
  }
  p {
    margin: 0;
    font-style: italic;
    font-size: 1.15rem;
    line-height: 1.5;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
</style>
