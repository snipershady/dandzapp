<script lang="ts">
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  type Props = HTMLSelectAttributes & {
    etichetta: string;
    value?: unknown;
    errore?: string | undefined;
    children: Snippet;
  };

  let { etichetta, value = $bindable(), errore, children, ...resto }: Props = $props();
  const id = $props.id();
</script>

<div class="campo">
  <label for={id}>{etichetta}</label>
  <select
    {id}
    bind:value
    aria-invalid={errore ? 'true' : undefined}
    aria-describedby={errore ? `${id}-errore` : undefined}
    {...resto}
  >
    {@render children()}
  </select>
  {#if errore}<p class="errore" id="{id}-errore">{errore}</p>{/if}
</div>

<style>
  .campo {
    display: grid;
    gap: 0.3rem;
    margin-bottom: 1rem;
  }
  label {
    font-weight: 600;
  }
  select {
    font: inherit;
    padding: 0.55rem 0.6rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    background: var(--sfondo);
    color: var(--testo);
  }
  .errore {
    margin: 0;
    font-size: 0.9rem;
    color: var(--errore);
  }
</style>
