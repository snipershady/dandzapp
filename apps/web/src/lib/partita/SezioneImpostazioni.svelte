<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { DettaglioPartita } from '@dandzapp/shared';
  import { api, ErroreApi } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';

  let { dettaglio, aggiorna }: { dettaglio: DettaglioPartita; aggiorna: () => Promise<void> } =
    $props();

  const partita = $derived(dettaglio.partita);
  const url = $derived(`/api/partite/${dettaglio.partita.id}`);
  // Titolo modificabile, precompilato con quello attuale.
  let titolo = $state(untrack(() => dettaglio.partita.titolo));
  let errore = $state<string | null>(null);
  const modulo = new StatoModulo();

  async function rinomina(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    await modulo.invia(async () => {
      await api(url, { metodo: 'PATCH', corpo: { titolo } });
      await aggiorna();
    });
  }

  async function azione(f: () => Promise<unknown>): Promise<void> {
    try {
      errore = null;
      await f();
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Operazione non riuscita';
    }
  }

  const cambiaStato = () =>
    azione(async () => {
      const stato = partita.stato === 'attiva' ? 'archiviata' : 'attiva';
      await api(url, { metodo: 'PATCH', corpo: { stato } });
      await aggiorna();
    });

  const elimina = () =>
    azione(async () => {
      await api(url, { metodo: 'DELETE' });
      await goto(resolve(''), { replaceState: true, invalidateAll: true });
    });
</script>

<section aria-labelledby="titolo-impostazioni">
  <h2 id="titolo-impostazioni">Impostazioni</h2>
  {#if errore}<Avviso>{errore}</Avviso>{/if}
  <form class="rinomina" onsubmit={rinomina} novalidate>
    <Campo
      etichetta="Titolo"
      name="titolo"
      maxlength={120}
      bind:value={titolo}
      errore={modulo.campi['titolo']}
    />
    <button type="submit" disabled={modulo.inInvio || titolo === partita.titolo}>Rinomina</button>
  </form>

  <div class="riga">
    <span>
      {partita.stato === 'attiva'
        ? 'Archivia la partita quando è finita: resta consultabile, ma non accetta nuovi inviti.'
        : 'La partita è archiviata.'}
    </span>
    <PulsanteConferma
      testo={partita.stato === 'attiva' ? 'Archivia' : 'Riattiva'}
      domanda={partita.stato === 'attiva' ? 'Archiviare la partita?' : 'Riattivare la partita?'}
      onconferma={cambiaStato}
    />
  </div>

  <div class="riga">
    <span>
      Esporta lo stato della partita (nebbia, pedine, mostri, narrazione, tiri) in un file JSON
      (RF-95). Il file contiene le email dei partecipanti: conservalo con cura.
    </span>
    <!-- Download dall'API, non una pagina della SPA: resolve() non c'entra. -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a class="pulsante" href="/api/partite/{partita.id}/backup" download>Esporta (JSON)</a>
  </div>

  <div class="riga pericolo">
    <span>Elimina la partita con personaggi, partecipanti e inviti. Non si può annullare.</span>
    <PulsanteConferma
      testo="Elimina la partita"
      domanda="Eliminare definitivamente “{partita.titolo}”?"
      conferma="Elimina"
      pericolosa
      onconferma={elimina}
    />
  </div>
</section>

<style>
  .rinomina {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0 0.75rem;
  }
  .rinomina :global(.campo) {
    flex: 1 1 16rem;
  }
  .rinomina button {
    margin-bottom: 1rem;
  }
  .pulsante {
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    color: var(--testo);
    text-decoration: none;
    background: var(--superficie);
  }
  .riga {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--bordo);
  }
  .pericolo span {
    color: var(--errore);
  }
</style>
