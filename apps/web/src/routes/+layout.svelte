<script lang="ts">
  import '@fontsource/alegreya-sans/400.css';
  import '@fontsource/alegreya-sans/400-italic.css';
  import '@fontsource/alegreya-sans/700.css';
  import '@fontsource/jetbrains-mono/400.css';
  import '@fontsource/jetbrains-mono/700.css';
  import '@fontsource/marcellus-sc/400.css';
  import type { Snippet } from 'svelte';
  import { tema } from '#lib/tema.svelte.ts';

  let { children }: { children: Snippet } = $props();

  // Prima del primo disegno: niente lampo di colori sbagliati (RNF-03).
  tema.carica();
</script>

<svelte:head>
  <title>Tavolo virtuale · D&D BECMI</title>
</svelte:head>

{@render children()}

<style>
  /*
   * Palette (RNF-03): sabbia del deserto, papiro, lapislazzuli nithiano, corniola.
   * Ogni colore ha la versione chiara e quella scura (light-dark): vale quella del
   * `color-scheme`, che segue il dispositivo o l'interruttore del tema (data-tema).
   * I caratteri sono ospitati nell'app (@fontsource): nessuna richiesta a siti esterni.
   */
  :global(:root) {
    color-scheme: light dark;
    --sfondo: light-dark(#efe4cc, #1b1712);
    --superficie: light-dark(#faf4e6, #27211a);
    --bordo: light-dark(#cdb98f, #4a3f30);
    --testo: light-dark(#2b2116, #efe4cc);
    --testo-tenue: light-dark(#6b5a42, #b8a789);
    --accento: light-dark(#1f4f8f, #8fb4ea);
    --su-accento: light-dark(#faf4e6, #1b1712);
    --errore: light-dark(#a8322a, #ec8b80);
    --errore-sfondo: light-dark(#f7e1dd, #3a201c);
    --successo: light-dark(#3e6b2a, #9fcf86);
    --successo-sfondo: light-dark(#e4eed9, #1f2e19);
    /* Tavolo: nebbia sulle zone non scoperte e bordo della propria pedina (RF-32). */
    --nebbia: light-dark(#3a3128, #0f0d0a);
    --nebbia-griglia: light-dark(rgb(239 228 204 / 0.08), rgb(239 228 204 / 0.06));
    --oro: light-dark(#d4a017, #e8c04a);
    --font-titoli: 'Marcellus SC', Georgia, serif;
    --font-testo: 'Alegreya Sans', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  }
  :global(:root[data-tema='chiaro']) {
    color-scheme: light;
  }
  :global(:root[data-tema='scuro']) {
    color-scheme: dark;
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
