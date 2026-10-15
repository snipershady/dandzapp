<script lang="ts">
  import { conPunti } from '#lib/testo.ts';
  import {
    RispostaInvitoCreato,
    type DettaglioPartita,
    type RuoloPartecipante,
  } from '@dandzapp/shared';
  import { api, ErroreApi } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import Selettore from '#lib/componenti/Selettore.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';

  let { dettaglio, aggiorna }: { dettaglio: DettaglioPartita; aggiorna: () => Promise<void> } =
    $props();

  const base = $derived(`/api/partite/${dettaglio.partita.id}/inviti`);
  const liberi = $derived(dettaglio.personaggi.filter((p) => p.utenteId === null));
  const nomePg = (id: number | null) => dettaglio.personaggi.find((p) => p.id === id)?.nome;
  const archiviata = $derived(dettaglio.partita.stato === 'archiviata');

  let email = $state('');
  let ruolo = $state<RuoloPartecipante>('giocatore');
  let personaggioId = $state<number | null>(null);
  let ultimo = $state<{ email: string; link: string } | null>(null);
  let copiato = $state(false);
  let errore = $state<string | null>(null);
  const modulo = new StatoModulo();

  async function invita(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    await modulo.invia(async () => {
      const { invito, link } = await api(base, {
        metodo: 'POST',
        corpo: { email, ruolo, personaggioId: ruolo === 'giocatore' ? personaggioId : null },
        schema: RispostaInvitoCreato,
      });
      ultimo = { email: invito.email, link };
      copiato = false;
      email = '';
      personaggioId = null;
      await aggiorna();
    });
  }

  async function copia(): Promise<void> {
    if (!ultimo) return;
    try {
      await navigator.clipboard.writeText(ultimo.link);
      copiato = true;
    } catch {
      copiato = false;
    }
  }

  async function revoca(id: number): Promise<void> {
    try {
      errore = null;
      await api(`${base}/${id}`, { metodo: 'DELETE' });
      await aggiorna();
    } catch (e) {
      errore = e instanceof ErroreApi ? e.message : 'Revoca non riuscita';
    }
  }

  const formatoData = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' });
</script>

<section aria-labelledby="titolo-inviti">
  <h2 id="titolo-inviti">Invita</h2>
  <p class="nota">
    L'invito arriva per email e vale solo per quell'indirizzo: chi lo riceve entra con il ruolo che
    scegli qui. Non esistono link pubblici alla partita.
  </p>

  {#if archiviata}
    <Avviso>La partita è archiviata: riattivala dalle impostazioni per invitare qualcuno.</Avviso>
  {:else}
    {#if modulo.errore}<Avviso>{modulo.errore}</Avviso>{/if}
    <form onsubmit={invita} novalidate>
      <div class="campi">
        <Campo
          etichetta="Email"
          name="email"
          type="email"
          required
          bind:value={email}
          errore={modulo.campi['email']}
        />
        <fieldset>
          <legend>Ruolo</legend>
          <label><input type="radio" value="giocatore" bind:group={ruolo} /> Giocatore</label>
          <label
            ><input type="radio" value="osservatore" bind:group={ruolo} /> Osservatore (sola lettura)</label
          >
        </fieldset>
        {#if ruolo === 'giocatore'}
          <Selettore
            etichetta="Personaggio"
            bind:value={personaggioId}
            errore={modulo.campi['personaggioId']}
          >
            <option value={null}>Lo assegno dopo</option>
            {#each liberi as pg (pg.id)}<option value={pg.id}>{pg.nome}</option>{/each}
          </Selettore>
        {/if}
      </div>
      <button class="salva" type="submit" disabled={modulo.inInvio}>Invia l'invito</button>
    </form>
  {/if}

  {#if ultimo}
    <div class="link-invito" role="status">
      <p>
        Invito inviato a <strong>{ultimo.email}</strong>. Puoi anche consegnare questo link a mano,
        per esempio in chat (vale solo per quell'email):
      </p>
      <div class="copia">
        <input
          readonly
          value={ultimo.link}
          aria-label="Link d'invito"
          onfocus={(e) => e.currentTarget.select()}
        />
        <button type="button" onclick={copia}>{copiato ? 'Copiato' : 'Copia'}</button>
      </div>
    </div>
  {/if}

  {#if errore}<Avviso>{errore}</Avviso>{/if}
  {#if dettaglio.inviti?.length}
    <h3>In attesa</h3>
    <ul class="elenco">
      {#each dettaglio.inviti as i (i.id)}
        <li aria-label="Invito a {i.email}">
          <span class="identita">
            <strong>{i.email}</strong>
            <span class="tenue" class:scaduto={i.scaduto}>
              {conPunti(
                i.ruolo === 'giocatore' ? 'Giocatore' : 'Osservatore',
                i.personaggioId !== null && nomePg(i.personaggioId),
                i.scaduto ? 'scaduto' : `scade il ${formatoData.format(new Date(i.scadeIl))}`,
              )}
            </span>
          </span>
          <PulsanteConferma
            testo="Revoca"
            domanda="Revocare l'invito?"
            conferma="Revoca"
            pericolosa
            onconferma={() => revoca(i.id)}
          />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .nota,
  .tenue {
    color: var(--testo-tenue);
  }
  .campi {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0 1rem;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 1rem;
    display: grid;
    gap: 0.25rem;
  }
  legend {
    font-weight: 600;
    padding: 0;
    margin-bottom: 0.3rem;
  }
  .salva {
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
    font-weight: 700;
  }
  .link-invito {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--successo);
    background: var(--successo-sfondo);
    border-radius: 0.5rem;
  }
  .link-invito p {
    margin-top: 0;
  }
  .copia {
    display: flex;
    gap: 0.5rem;
  }
  .copia input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    background: var(--sfondo);
    color: var(--testo);
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
    gap: 0.5rem;
    align-items: center;
    padding: 0.6rem 0.75rem;
    background: var(--sfondo);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  .identita {
    display: grid;
    margin-right: auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .scaduto {
    color: var(--errore);
  }
</style>
