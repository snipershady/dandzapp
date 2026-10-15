<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { RispostaPartitaCreata } from '@dandzapp/shared';
  import { api } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  let titolo = $state('');
  let avventura = $state(untrack(() => data.avventure[0]?.id ?? ''));
  const modulo = new StatoModulo();
  const scelta = $derived(data.avventure.find((a) => a.id === avventura));

  async function crea(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    let id = 0;
    const ok = await modulo.invia(async () => {
      ({ id } = await api('/api/partite', {
        metodo: 'POST',
        corpo: { titolo, avventura },
        schema: RispostaPartitaCreata,
      }));
    });
    if (ok) await goto(resolve(`partite/${id}/gestione`));
  }
</script>

<svelte:head><title>Nuova partita · Tavolo virtuale</title></svelte:head>

<main>
  <p><a href={resolve('')}>← Le mie partite</a></p>
  <h1>Nuova partita</h1>

  {#if data.avventure.length === 0}
    <Avviso>
      Non c'è ancora nessuna avventura. Preparane una e importala con
      <code>npm run avventura:importa</code> (vedi la §8 di CLAUDE.md).
    </Avviso>
  {:else}
    {#if modulo.errore}<Avviso>{modulo.errore}</Avviso>{/if}
    <form class="scheda" onsubmit={crea} novalidate>
      <Campo
        etichetta="Titolo della partita"
        name="titolo"
        required
        maxlength={120}
        aiuto="Per esempio il nome della campagna o del gruppo."
        bind:value={titolo}
        errore={modulo.campi['titolo']}
      />

      <fieldset>
        <legend>Avventura</legend>
        <p class="nota">La partita userà questa avventura per tutta la sua durata.</p>
        {#each data.avventure as a (a.id)}
          <label class="avventura" class:scelta={a.id === avventura}>
            <input type="radio" name="avventura" value={a.id} bind:group={avventura} />
            <span>
              <strong>{a.titolo}</strong>
              {#if a.sottotitolo}<span class="tenue"> · {a.sottotitolo}</span>{/if}
              <span class="tenue dettagli">
                {a.numeroZone} zone · fino a {a.numeroPartenze} PG nei posti di partenza
              </span>
            </span>
          </label>
        {/each}
        {#if modulo.campi['avventura']}<p class="errore">{modulo.campi['avventura']}</p>{/if}
      </fieldset>

      {#if scelta?.mostri.length}
        <p class="nota">Mostri previsti: {scelta.mostri.join(', ')}.</p>
      {/if}

      <button class="primario" type="submit" disabled={modulo.inInvio}>Crea la partita</button>
    </form>
  {/if}
</main>

<style>
  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }
  h1 {
    font-family: var(--font-titoli);
  }
  .scheda {
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.75rem;
    padding: 1.5rem;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 1rem;
  }
  legend {
    font-weight: 600;
    padding: 0;
  }
  .avventura {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.75rem;
    margin-top: 0.5rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .avventura.scelta {
    border-color: var(--accento);
    outline: 1px solid var(--accento);
  }
  .avventura input {
    margin-top: 0.3rem;
  }
  .tenue,
  .nota {
    color: var(--testo-tenue);
  }
  .dettagli {
    display: block;
    font-size: 0.9rem;
  }
  .errore {
    color: var(--errore);
  }
</style>
