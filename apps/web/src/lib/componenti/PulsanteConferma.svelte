<script lang="ts">
  /**
   * Azione da confermare in due passaggi, dentro la pagina (RNF-09: niente finestre
   * del browser). Al primo clic compare la domanda con Conferma e Annulla.
   */
  let {
    testo,
    domanda,
    conferma = 'Conferma',
    pericolosa = false,
    disabled = false,
    onconferma,
  }: {
    testo: string;
    domanda: string;
    conferma?: string;
    pericolosa?: boolean;
    disabled?: boolean;
    onconferma: () => unknown;
  } = $props();

  let aperta = $state(false);
  let inCorso = $state(false);

  async function esegui(): Promise<void> {
    inCorso = true;
    try {
      await onconferma();
    } finally {
      inCorso = false;
      aperta = false;
    }
  }
</script>

{#if aperta}
  <span class="conferma" role="group" aria-label={domanda}>
    <span class="domanda">{domanda}</span>
    <button type="button" class:pericolosa class="si" disabled={inCorso} onclick={esegui}
      >{conferma}</button
    >
    <button type="button" disabled={inCorso} onclick={() => (aperta = false)}>Annulla</button>
  </span>
{:else}
  <button type="button" class:pericolosa {disabled} onclick={() => (aperta = true)}>{testo}</button>
{/if}

<style>
  .conferma {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .domanda {
    font-weight: 600;
  }
  .si {
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
  }
  .pericolosa {
    color: var(--errore);
    border-color: var(--errore);
  }
  .si.pericolosa {
    background: var(--errore);
    color: var(--su-accento);
  }
  button {
    padding: 0.35rem 0.75rem;
  }
</style>
