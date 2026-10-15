<script lang="ts">
  import type { CorpoPersonaggio, DettaglioPartita } from '@dandzapp/shared';
  import { api, ErroreApi } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import FormPersonaggio from './FormPersonaggio.svelte';
  import Pedina from './Pedina.svelte';

  let { dettaglio, aggiorna }: { dettaglio: DettaglioPartita; aggiorna: () => Promise<void> } =
    $props();

  const base = $derived(`/api/partite/${dettaglio.partita.id}/personaggi`);
  const giocatori = $derived(dettaglio.partecipanti.filter((p) => p.ruolo === 'giocatore'));
  const nomeDi = (id: number | null) => giocatori.find((g) => g.utenteId === id)?.nome;
  let inModifica = $state<number | null>(null);
  let errore = $state<string | null>(null);

  // Colori delle pedine del gruppo (CLAUDE.md §2), proposti in ordine ai nuovi PG.
  const TAVOLOZZA = [
    '#a8322a',
    '#8a5a1c',
    '#4f6b2a',
    '#2c6a8f',
    '#6b3f86',
    '#1f4f8f',
    '#a05a2c',
    '#3d6b5a',
  ];
  const coloreLibero = $derived(
    TAVOLOZZA.find((c) => !dettaglio.personaggi.some((p) => p.colore === c)) ?? TAVOLOZZA[0],
  );

  async function crea(dati: CorpoPersonaggio): Promise<void> {
    await api(base, { metodo: 'POST', corpo: dati });
    await aggiorna();
  }

  async function modifica(id: number, dati: Partial<CorpoPersonaggio>): Promise<void> {
    await api(`${base}/${id}`, { metodo: 'PATCH', corpo: dati });
    inModifica = null;
    await aggiorna();
  }

  async function azione(f: () => Promise<unknown>): Promise<void> {
    try {
      errore = null;
      await f();
      await aggiorna();
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Operazione non riuscita';
    }
  }
</script>

<section aria-labelledby="titolo-pg">
  <h2 id="titolo-pg">Personaggi</h2>
  <p class="nota">
    I PG appartengono alla partita. Assegnali ai giocatori: ognuno parte da uno dei posti di
    partenza dell'avventura, in ordine.
  </p>
  {#if errore}<Avviso>{errore}</Avviso>{/if}

  {#if dettaglio.personaggi.length}
    <ul class="elenco">
      {#each dettaglio.personaggi as pg (pg.id)}
        <li aria-label={pg.nome}>
          {#if inModifica === pg.id}
            <FormPersonaggio
              iniziale={pg}
              {giocatori}
              testoSalva="Salva"
              onsalva={(dati) => modifica(pg.id, dati)}
              onannulla={() => (inModifica = null)}
            />
          {:else}
            <Pedina colore={pg.colore} sigla={pg.sigla} nome={pg.nome} />
            <span class="identita">
              <span class="riga"
                ><strong>{pg.nome}</strong><span class="tenue"
                  >{pg.classe ? ` · ${pg.classe}` : ''}</span
                ></span
              >
              <span class="tenue">{nomeDi(pg.utenteId) ?? 'Nessun giocatore'}</span>
            </span>
            <span class="azioni">
              <button type="button" onclick={() => (inModifica = pg.id)}>Modifica</button>
              <PulsanteConferma
                testo="Elimina"
                domanda="Eliminare {pg.nome}?"
                conferma="Elimina"
                pericolosa
                onconferma={() => azione(() => api(`${base}/${pg.id}`, { metodo: 'DELETE' }))}
              />
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <details open={dettaglio.personaggi.length === 0}>
    <summary>Aggiungi un personaggio</summary>
    {#key dettaglio.personaggi.length}
      <FormPersonaggio
        {giocatori}
        coloreSuggerito={coloreLibero}
        testoSalva="Aggiungi"
        onsalva={crea}
      />
    {/key}
  </details>
</section>

<style>
  .nota,
  .tenue {
    color: var(--testo-tenue);
  }
  .elenco {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
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
  li :global(.form-pg) {
    width: 100%;
  }
  .identita {
    display: grid;
    margin-right: auto;
  }
  .azioni {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .azioni button {
    padding: 0.35rem 0.75rem;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
</style>
