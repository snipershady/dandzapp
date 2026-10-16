<script lang="ts">
  import { FACCE, type ComandoTira, type RispostaTiro, type Tiro } from '@dandzapp/shared';
  import { formula, naturale } from './tiri.ts';

  /**
   * Dadi (RF-50…RF-54): un pulsante per dado e la scorciatoia 3d6, con numero di dadi,
   * modificatore e motivo. Il tiro lo fa il server; qui si mostra il risultato in grande.
   */
  let {
    master,
    blocco,
    tira,
  }: {
    master: boolean;
    /** Perché non si può tirare (es. nessun PG scelto), oppure `null`. */
    blocco: string | null;
    tira: (comando: ComandoTira) => Promise<RispostaTiro>;
  } = $props();

  let numero = $state(1);
  let modificatore = $state(0);
  let motivo = $state('');
  let nascosto = $state(false);
  let inCorso = $state(false);
  let ultimo = $state<Tiro | null>(null);
  let errore = $state<string | null>(null);

  const limita = (v: number, min: number, max: number) =>
    Math.min(Math.max(Math.trunc(Number.isFinite(v) ? v : min), min), max);

  async function lancia(facce: (typeof FACCE)[number], quanti = numero): Promise<void> {
    inCorso = true;
    errore = null;
    const r = await tira({
      facce,
      numero: limita(quanti, 1, 20),
      modificatore: limita(modificatore, -20, 50),
      motivo: motivo.trim(),
      nascosto: master && nascosto,
    });
    inCorso = false;
    if (r.ok) ultimo = r.tiro;
    else errore = r.errore;
  }

  const esito = $derived(ultimo ? naturale(ultimo) : null);
</script>

<section aria-labelledby="dadi" class="dadi">
  <h2 id="dadi">Dadi</h2>
  {#if blocco}
    <p class="blocco" role="note">{blocco}</p>
  {/if}
  <div class="pulsanti">
    {#each FACCE as f (f)}
      <button type="button" disabled={inCorso || !!blocco} onclick={() => lancia(f)}>d{f}</button>
    {/each}
    <button type="button" disabled={inCorso || !!blocco} onclick={() => lancia(6, 3)}>3d6</button>
  </div>
  <div class="campi">
    <label>
      Dadi
      <input type="number" min="1" max="20" bind:value={numero} disabled={!!blocco} />
    </label>
    <label>
      Modificatore
      <input type="number" min="-20" max="50" bind:value={modificatore} disabled={!!blocco} />
    </label>
    <label class="motivo">
      Motivo
      <input
        type="text"
        maxlength="60"
        placeholder="es. attacco, TS veleno"
        bind:value={motivo}
        disabled={!!blocco}
      />
    </label>
  </div>
  {#if master}
    <label class="nascosto">
      <input type="checkbox" bind:checked={nascosto} />
      Tiro nascosto (lo vedi solo tu)
    </label>
  {/if}

  <!-- Il risultato in grande (RF-53), annunciato anche ai lettori di schermo. -->
  <p
    class="risultato"
    class:venti={esito === 'venti'}
    class:uno={esito === 'uno'}
    aria-live="polite"
  >
    {#if ultimo}
      <span class="formula">{formula(ultimo)}</span>
      <span aria-hidden="true">→</span>
      <span class="sr">risultato</span>
      <strong data-totale>{ultimo.totale}</strong>
      {#if esito === 'venti'}<span class="nota">20 naturale!</span>{/if}
      {#if esito === 'uno'}<span class="nota">1 naturale</span>{/if}
      {#if ultimo.nascosto}<span class="nota">nascosto</span>{/if}
    {/if}
  </p>
  {#if errore}<p class="errore" role="alert">{errore}</p>{/if}
</section>

<style>
  h2 {
    font-family: var(--font-titoli);
    margin-top: 0;
  }
  .dadi {
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.75rem;
    padding: 1rem;
  }
  .pulsanti {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .pulsanti button {
    font-family: var(--font-mono);
    font-weight: 700;
    min-width: 3.4rem;
    padding: 0.5rem 0.6rem;
  }
  .campi {
    display: grid;
    grid-template-columns: 5rem 7rem 1fr;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  @media (max-width: 30rem) {
    .campi {
      grid-template-columns: 1fr 1fr;
    }
    .motivo {
      grid-column: 1 / -1;
    }
  }
  label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.9rem;
    font-weight: 600;
  }
  input[type='number'],
  input[type='text'] {
    font: inherit;
    font-weight: 400;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--bordo);
    border-radius: 0.4rem;
    background: var(--sfondo);
    color: var(--testo);
    min-width: 0;
  }
  input[type='number'] {
    font-family: var(--font-mono);
  }
  .nascosto {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.6rem;
    font-weight: 400;
  }
  .risultato {
    min-height: 3rem;
    margin: 0.75rem 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 1.3rem;
  }
  .risultato strong {
    font-size: 2.4rem;
  }
  .venti strong {
    color: var(--successo);
  }
  .uno strong {
    color: var(--errore);
  }
  .nota {
    font-family: var(--font-testo);
    font-size: 0.95rem;
    color: var(--testo-tenue);
  }
  .venti .nota {
    color: var(--successo);
  }
  .uno .nota {
    color: var(--errore);
  }
  .blocco,
  .errore {
    color: var(--errore);
    font-weight: 600;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
