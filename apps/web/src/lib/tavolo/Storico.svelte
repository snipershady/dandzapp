<script lang="ts">
  import type { RispostaComando, Tiro } from '@dandzapp/shared';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import { formula, naturale, ora } from './tiri.ts';

  /**
   * Storico condiviso degli ultimi tiri, dal più recente (RF-60). Il Master vede anche i
   * suoi tiri nascosti (RF-61) e può svuotarlo con conferma in due passaggi (RF-62).
   */
  let {
    tiri,
    master,
    svuota,
    onerrore,
  }: {
    tiri: Tiro[];
    master: boolean;
    svuota: () => Promise<RispostaComando>;
    onerrore: (messaggio: string) => void;
  } = $props();

  async function conferma(): Promise<void> {
    const r = await svuota();
    if (!r.ok) onerrore(r.errore);
  }
</script>

<section aria-labelledby="storico" class="storico">
  <div class="testa">
    <h2 id="storico">Storico dei tiri</h2>
    {#if master && tiri.length > 0}
      <PulsanteConferma
        testo="Svuota"
        domanda="Svuotare lo storico per tutti?"
        conferma="Svuota"
        pericolosa
        onconferma={conferma}
      />
    {/if}
  </div>
  {#if tiri.length === 0}
    <p class="tenue">Ancora nessun tiro.</p>
  {:else}
    <ol>
      {#each tiri as t (t.id)}
        {@const n = naturale(t)}
        <li class:nascosto={t.nascosto} aria-label="{t.personaggio}: {formula(t)} = {t.totale}">
          <div class="chi">
            <strong>{t.personaggio}</strong>
            <span class="tenue">{t.utente}</span>
            {#if t.nascosto}<span class="etichetta">nascosto</span>{/if}
            <time class="tenue" datetime={t.creatoIl}>{ora(t.creatoIl)}</time>
          </div>
          {#if t.motivo}<div class="motivo">{t.motivo}</div>{/if}
          <div class="tiro">
            <span>{formula(t)}</span>
            <span class="tenue">[{t.risultati.join(', ')}]</span>
            <span aria-hidden="true">→</span>
            <strong class:venti={n === 'venti'} class:uno={n === 'uno'}>{t.totale}</strong>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .testa {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  h2 {
    font-family: var(--font-titoli);
    margin: 0;
  }
  .tenue {
    color: var(--testo-tenue);
  }
  ol {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 0;
    display: grid;
    gap: 0.4rem;
    max-height: 26rem;
    overflow-y: auto;
  }
  li {
    padding: 0.45rem 0.65rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  li.nascosto {
    border-style: dashed;
  }
  .chi {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.5rem;
    align-items: baseline;
  }
  .chi time {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .motivo {
    font-style: italic;
  }
  .tiro {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: baseline;
    font-family: var(--font-mono);
  }
  .tiro strong {
    font-size: 1.15rem;
  }
  .venti {
    color: var(--successo);
  }
  .uno {
    color: var(--errore);
  }
  .etichetta {
    font-size: 0.75rem;
    padding: 0 0.4rem;
    border: 1px solid var(--bordo);
    border-radius: 1rem;
  }
</style>
