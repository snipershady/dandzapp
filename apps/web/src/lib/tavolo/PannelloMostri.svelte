<script lang="ts">
  import {
    zonaDi,
    type ComandoAggiungiMostri,
    type Mostro,
    type RispostaComando,
    type ZonaPartita,
  } from '@dandzapp/shared';
  import { untrack } from 'svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import Selettore from '#lib/componenti/Selettore.svelte';

  /**
   * Pannello del Master per i mostri (RF-40…RF-43): li aggiunge in una zona, anche coperta
   * (così li prepara in anticipo), e li toglie uno alla volta o tutti, con conferma.
   */
  let {
    mostri,
    tipi,
    zone,
    disabilitato = false,
    aggiungi,
    togli,
    togliTutti,
    onerrore,
  }: {
    mostri: Mostro[];
    tipi: { nome: string; sigla: string }[];
    zone: ZonaPartita[];
    disabilitato?: boolean;
    aggiungi: (comando: ComandoAggiungiMostri) => Promise<RispostaComando>;
    togli: (mostroId: number) => Promise<RispostaComando>;
    togliTutti: () => Promise<RispostaComando>;
    onerrore: (messaggio: string) => void;
  } = $props();

  const ALTRO = '';
  // Valori iniziali: il primo tipo dell'avventura e la prima zona.
  let tipo = $state(untrack(() => tipi[0]?.sigla ?? ALTRO));
  let altro = $state('');
  let quantita = $state('1');
  let zonaId = $state(untrack(() => zone[0]?.id ?? ''));
  let inCorso = $state(false);
  let erroreNome = $state<string | undefined>();

  async function invia(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    erroreNome = undefined;
    if (tipo === ALTRO && altro.trim() === '') {
      erroreNome = 'Scrivi il nome del mostro';
      return;
    }
    inCorso = true;
    const r = await aggiungi({
      ...(tipo === ALTRO ? { altro: altro.trim() } : { tipo }),
      quantita: Number(quantita),
      zonaId,
    });
    inCorso = false;
    if (!r.ok) onerrore(r.errore);
    else if (tipo === ALTRO) altro = '';
  }

  async function esito(p: Promise<RispostaComando>): Promise<void> {
    const r = await p;
    if (!r.ok) onerrore(r.errore);
  }

  const dove = (m: Mostro) => {
    const z = zonaDi(zone, [m.x, m.y]);
    if (!z) return 'fuori dalle zone: nascosto ai giocatori';
    return z.scoperta ? z.nome : `${z.nome} (coperta)`;
  };
</script>

<section aria-labelledby="mostri">
  <h2 id="mostri">Mostri</h2>
  <form onsubmit={invia}>
    <Selettore etichetta="Tipo" bind:value={tipo} disabled={disabilitato}>
      {#each tipi as t (t.sigla)}
        <option value={t.sigla}>{t.nome}</option>
      {/each}
      <option value={ALTRO}>Altro…</option>
    </Selettore>
    {#if tipo === ALTRO}
      <Campo
        etichetta="Nome del mostro"
        name="altro"
        bind:value={altro}
        maxlength={60}
        errore={erroreNome}
        disabled={disabilitato}
      />
    {/if}
    <div class="riga">
      <Selettore etichetta="Quantità" bind:value={quantita} disabled={disabilitato}>
        {#each Array.from({ length: 12 }, (_, i) => String(i + 1)) as n (n)}
          <option value={n}>{n}</option>
        {/each}
      </Selettore>
      <Selettore etichetta="Zona di comparsa" bind:value={zonaId} disabled={disabilitato}>
        {#each zone as z (z.id)}
          <option value={z.id}>{z.nome}{z.scoperta ? '' : ' (coperta)'}</option>
        {/each}
      </Selettore>
    </div>
    <button type="submit" class="primario" disabled={disabilitato || inCorso}>Aggiungi</button>
  </form>

  {#if mostri.length > 0}
    <ul>
      {#each mostri as m (m.id)}
        <li aria-label="{m.nome} {m.sigla}">
          <span class="rombo" aria-hidden="true"></span>
          <span class="testo">
            <strong>{m.sigla}</strong>
            {m.nome}
            <span class="tenue">{dove(m)}</span>
          </span>
          <PulsanteConferma
            testo="Togli"
            domanda="Togliere {m.sigla}?"
            conferma="Togli"
            pericolosa
            disabled={disabilitato}
            onconferma={() => esito(togli(m.id))}
          />
        </li>
      {/each}
    </ul>
    <PulsanteConferma
      testo="Togli tutti i mostri"
      domanda="Togliere tutti i {mostri.length} mostri?"
      conferma="Togli tutti"
      pericolosa
      disabled={disabilitato}
      onconferma={() => esito(togliTutti())}
    />
  {:else}
    <p class="tenue">Nessun mostro sul tavolo.</p>
  {/if}
</section>

<style>
  h2 {
    font-family: var(--font-titoli);
  }
  .riga {
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: 0 0.75rem;
  }
  .primario {
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
    font-weight: 700;
    padding: 0.45rem 1rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    display: grid;
    gap: 0.4rem;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.4rem 0.6rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  .testo {
    flex: 1;
    min-width: 8rem;
  }
  .tenue {
    display: block;
    font-size: 0.85rem;
    color: var(--testo-tenue);
  }
  .rombo {
    width: 0.8rem;
    height: 0.8rem;
    background: #a8322a;
    transform: rotate(45deg);
    flex: none;
  }
</style>
