<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Tavolo virtuale · D&D BECMI</title>
</svelte:head>

{@render children()}

<style>
  /* Palette (RNF-03): sabbia del deserto, papiro, lapislazzuli nithiano, corniola. */
  :global(:root) {
    --sfondo: #efe4cc;
    --superficie: #faf4e6;
    --bordo: #cdb98f;
    --testo: #2b2116;
    --testo-tenue: #6b5a42;
    --accento: #1f4f8f;
    --su-accento: #faf4e6;
    --errore: #a8322a;
    --errore-sfondo: #f7e1dd;
    --successo: #3e6b2a;
    --successo-sfondo: #e4eed9;
    --font-titoli: 'Marcellus SC', Georgia, serif;
    --font-testo: 'Alegreya Sans', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --sfondo: #1b1712;
      --superficie: #27211a;
      --bordo: #4a3f30;
      --testo: #efe4cc;
      --testo-tenue: #b8a789;
      --accento: #8fb4ea;
      --su-accento: #1b1712;
      --errore: #ec8b80;
      --errore-sfondo: #3a201c;
      --successo: #9fcf86;
      --successo-sfondo: #1f2e19;
      color-scheme: dark;
    }
  }
  :global(body) {
    margin: 0;
    background: var(--sfondo);
    color: var(--testo);
    font-family: var(--font-testo);
    font-size: 1.05rem;
    line-height: 1.5;
  }
  :global(h2) {
    font-family: var(--font-titoli);
    margin-top: 0;
  }
  :global(a) {
    color: var(--accento);
  }
  :global(:focus-visible) {
    outline: 3px solid var(--accento);
    outline-offset: 2px;
  }
  :global(button) {
    font: inherit;
    cursor: pointer;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--bordo);
    background: var(--superficie);
    color: var(--testo);
  }
  :global(button.primario) {
    width: 100%;
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
    font-weight: 700;
  }
  :global(button:disabled) {
    opacity: 0.6;
    cursor: progress;
  }
  :global(.link) {
    text-align: center;
    margin: 0.75rem 0 0;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(*) {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
