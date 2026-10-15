<script lang="ts">
  import type { DettaglioPartita, RuoloPartecipante } from '@dandzapp/shared';
  import { api, ErroreApi } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';

  let { dettaglio, aggiorna }: { dettaglio: DettaglioPartita; aggiorna: () => Promise<void> } =
    $props();

  const base = $derived(`/api/partite/${dettaglio.partita.id}/partecipanti`);
  let errore = $state<string | null>(null);

  async function azione(f: () => Promise<unknown>): Promise<void> {
    try {
      errore = null;
      await f();
      await aggiorna();
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Operazione non riuscita';
    }
  }

  const cambiaRuolo = (utenteId: number, ruolo: RuoloPartecipante) =>
    azione(() => api(`${base}/${utenteId}`, { metodo: 'PATCH', corpo: { ruolo } }));
</script>

<section aria-labelledby="titolo-partecipanti">
  <h2 id="titolo-partecipanti">Partecipanti</h2>
  {#if errore}<Avviso>{errore}</Avviso>{/if}
  {#if dettaglio.partecipanti.length}
    <ul class="elenco">
      {#each dettaglio.partecipanti as p (p.utenteId)}
        <li aria-label={p.nome}>
          <strong class="nome">{p.nome}</strong>
          <label class="ruolo">
            <span class="nascosto">Ruolo di {p.nome}</span>
            <select
              value={p.ruolo}
              onchange={(e) => cambiaRuolo(p.utenteId, e.currentTarget.value as RuoloPartecipante)}
            >
              <option value="giocatore">Giocatore</option>
              <option value="osservatore">Osservatore</option>
            </select>
          </label>
          <PulsanteConferma
            testo="Togli"
            domanda="Togliere {p.nome} dalla partita?"
            conferma="Togli"
            pericolosa
            onconferma={() => azione(() => api(`${base}/${p.utenteId}`, { metodo: 'DELETE' }))}
          />
        </li>
      {/each}
    </ul>
    <p class="nota">
      Un osservatore vede il tavolo ma non tira i dadi né muove le pedine; perde i PG assegnati.
    </p>
  {:else}
    <p class="nota">Nessuno ha ancora accettato un invito.</p>
  {/if}
</section>

<style>
  .nota {
    color: var(--testo-tenue);
  }
  .elenco {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: center;
    padding: 0.6rem 0.75rem;
    background: var(--sfondo);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  .nome {
    margin-right: auto;
  }
  select {
    font: inherit;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    background: var(--superficie);
    color: var(--testo);
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
