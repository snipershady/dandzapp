<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Tavolo virtuale · D&D BECMI</title>
</svelte:head>

{@render children()}

<style>
  :global(:root) {
    --sabbia: #e9dcc0;
    --papiro: #f6efdd;
    --inchiostro: #2b2116;
    --lapislazzuli: #1f4f8f;
    --corniola: #a8322a;
    --verde: #3e7a3a;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --sabbia: #1d1913;
      --papiro: #2a241b;
      --inchiostro: #efe4cc;
      --lapislazzuli: #7fa8e0;
      --corniola: #e0776d;
      --verde: #8cc47f;
    }
  }
  :global(body) {
    margin: 0;
    background: var(--sabbia);
    color: var(--inchiostro);
    font-family: system-ui, sans-serif;
    line-height: 1.5;
  }
</style>
