<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = HTMLInputAttributes & {
    etichetta: string;
    name: string;
    value?: string;
    errore?: string | undefined;
    aiuto?: string;
  };

  let { etichetta, name, value = $bindable(''), errore, aiuto, ...resto }: Props = $props();
  const id = $props.id();
</script>

<div class="campo">
  <label for={id}>{etichetta}</label>
  <input
    {id}
    {name}
    bind:value
    aria-invalid={errore ? 'true' : undefined}
    aria-describedby={errore ? `${id}-errore` : aiuto ? `${id}-aiuto` : undefined}
    {...resto}
  />
  {#if errore}
    <p class="errore" id="{id}-errore">{errore}</p>
  {:else if aiuto}
    <p class="aiuto" id="{id}-aiuto">{aiuto}</p>
  {/if}
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
  input {
    font: inherit;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    background: var(--sfondo);
    color: var(--testo);
  }
  input[aria-invalid='true'] {
    border-color: var(--errore);
  }
  .errore,
  .aiuto {
    margin: 0;
    font-size: 0.9rem;
  }
  .errore {
    color: var(--errore);
  }
  .aiuto {
    color: var(--testo-tenue);
  }
</style>
