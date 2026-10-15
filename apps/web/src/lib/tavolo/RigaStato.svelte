<script lang="ts">
  import type { RuoloInPartita } from '@dandzapp/shared';
  import type { Collegamento } from './collegamento.svelte.ts';

  /** Riga di stato sotto il tavolo (RF-92). */
  let { collegamento, ruolo }: { collegamento: Collegamento; ruolo: RuoloInPartita } = $props();

  const TESTI = {
    collegamento: 'Collegamento…',
    collegato: 'Collegato in tempo reale',
    riconnessione: 'Riconnessione in corso: aggiorno ogni 5 secondi',
    scollegato: 'Non collegato',
  } as const;
  const ora = new Intl.DateTimeFormat('it-IT', { timeStyle: 'medium' });
  let inCorso = $state(false);

  async function aggiorna(): Promise<void> {
    inCorso = true;
    try {
      await collegamento.aggiornaOra();
    } finally {
      inCorso = false;
    }
  }
</script>

<div class="riga" role="status" aria-live="polite">
  <span class="spia {collegamento.stato}" aria-hidden="true"></span>
  <span>{TESTI[collegamento.stato]}</span>
  <span class="tenue">· {ruolo === 'osservatore' ? 'sola lettura' : 'puoi giocare'}</span>
  <span class="tenue">· aggiornato alle {ora.format(collegamento.ultimoAggiornamento)}</span>
  {#if collegamento.errore}<span class="errore">· {collegamento.errore}</span>{/if}
  <button type="button" onclick={aggiorna} disabled={inCorso}>Aggiorna ora</button>
</div>

<style>
  .riga {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  .spia {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    background: var(--testo-tenue);
  }
  .spia.collegato {
    background: var(--successo);
  }
  .spia.riconnessione,
  .spia.collegamento {
    background: #c9a227;
  }
  .spia.scollegato {
    background: var(--errore);
  }
  .tenue {
    color: var(--testo-tenue);
  }
  .errore {
    color: var(--errore);
  }
  button {
    margin-left: auto;
    padding: 0.25rem 0.75rem;
    font-size: 0.9rem;
  }
</style>
