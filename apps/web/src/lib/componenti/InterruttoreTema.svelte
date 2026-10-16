<script lang="ts">
  import { tema, type Tema } from '#lib/tema.svelte.ts';

  /** Interruttore del tema (RNF-03): automatico (come il dispositivo), chiaro o scuro. */
  const scelte: { valore: Tema; etichetta: string; simbolo: string }[] = [
    { valore: 'sistema', etichetta: 'Automatico', simbolo: '◐' },
    { valore: 'chiaro', etichetta: 'Chiaro', simbolo: '☀' },
    { valore: 'scuro', etichetta: 'Scuro', simbolo: '☾' },
  ];
</script>

<div class="tema" role="group" aria-label="Tema">
  {#each scelte as s (s.valore)}
    <button
      type="button"
      aria-pressed={tema.valore === s.valore}
      title="Tema: {s.etichetta.toLowerCase()}"
      onclick={() => tema.imposta(s.valore)}
    >
      <span aria-hidden="true">{s.simbolo}</span>
      <span class="nascosto">{s.etichetta}</span>
    </button>
  {/each}
</div>

<style>
  .tema {
    display: inline-flex;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  button {
    border: none;
    border-radius: 0;
    padding: 0.3rem 0.55rem;
    background: var(--superficie);
    color: var(--testo-tenue);
    line-height: 1;
  }
  button + button {
    border-left: 1px solid var(--bordo);
  }
  button[aria-pressed='true'] {
    background: var(--accento);
    color: var(--su-accento);
  }
  .nascosto {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
