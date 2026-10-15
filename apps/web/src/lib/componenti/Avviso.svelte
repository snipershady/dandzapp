<script lang="ts">
  import type { Snippet } from 'svelte';

  let { tipo = 'errore', children }: { tipo?: 'errore' | 'successo'; children: Snippet } = $props();
</script>

<div class="avviso {tipo}" role={tipo === 'errore' ? 'alert' : 'status'}>
  {@render children()}
</div>

<style>
  .avviso {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid;
  }
  .errore {
    color: var(--errore);
    border-color: var(--errore);
    background: var(--errore-sfondo);
  }
  .successo {
    color: var(--successo);
    border-color: var(--successo);
    background: var(--successo-sfondo);
  }
</style>
