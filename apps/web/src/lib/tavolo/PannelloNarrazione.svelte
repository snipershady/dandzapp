<script lang="ts">
  import { MAX_NARRAZIONE, type Narrazione, type RispostaComando } from '@dandzapp/shared';
  import PulsanteConferma from '#lib/componenti/PulsanteConferma.svelte';
  import { ora } from './tiri.ts';

  /**
   * Pannello del Master per la narrazione (RF-70): scrive e pubblica un testo, lo nasconde,
   * ripubblica o elimina i testi già usati. La bozza resta nel suo browser finché non la
   * pubblica.
   */
  let {
    corrente,
    storico,
    disabilitato = false,
    pubblica,
    ripubblica,
    elimina,
    nascondi,
    onerrore,
  }: {
    corrente: Narrazione | null;
    storico: Narrazione[];
    disabilitato?: boolean;
    pubblica: (testo: string) => Promise<RispostaComando>;
    ripubblica: (id: number) => Promise<RispostaComando>;
    elimina: (id: number) => Promise<RispostaComando>;
    nascondi: () => Promise<RispostaComando>;
    onerrore: (messaggio: string) => void;
  } = $props();

  let bozza = $state('');
  let inCorso = $state(false);

  async function esegui(azione: Promise<RispostaComando>): Promise<boolean> {
    inCorso = true;
    const r = await azione;
    inCorso = false;
    if (!r.ok) onerrore(r.errore);
    return r.ok;
  }

  async function invia(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    if (bozza.trim() === '') return;
    if (await esegui(pubblica(bozza))) bozza = '';
  }
</script>

<section aria-labelledby="narrazione">
  <h2 id="narrazione">Narrazione</h2>
  <form onsubmit={invia}>
    <label for="bozza">Testo da leggere ai giocatori</label>
    <textarea
      id="bozza"
      rows="4"
      maxlength={MAX_NARRAZIONE}
      bind:value={bozza}
      disabled={disabilitato}
      aria-describedby="conteggio"></textarea>
    <p id="conteggio" class="tenue">{bozza.length} / {MAX_NARRAZIONE}</p>
    <div class="azioni">
      <button
        type="submit"
        class="primario"
        disabled={disabilitato || inCorso || bozza.trim() === ''}>Pubblica</button
      >
      {#if corrente}
        <button type="button" disabled={disabilitato || inCorso} onclick={() => esegui(nascondi())}
          >Nascondi</button
        >
      {/if}
    </div>
  </form>

  {#if storico.length > 0}
    <h3>Testi già pubblicati</h3>
    <ul>
      {#each storico as n (n.id)}
        {@const mostrato = n.id === corrente?.id}
        <li class:mostrato>
          <p class="testo">{n.testo}</p>
          <div class="riga">
            <span class="tenue">
              {mostrato ? 'mostrato ora' : `ultima volta alle ${ora(n.pubblicataIl)}`}
            </span>
            {#if !mostrato}
              <button
                type="button"
                disabled={disabilitato || inCorso}
                onclick={() => esegui(ripubblica(n.id))}>Ripubblica</button
              >
            {/if}
            <PulsanteConferma
              testo="Elimina"
              domanda="Eliminare questo testo?"
              conferma="Elimina"
              pericolosa
              disabled={disabilitato}
              onconferma={() => esegui(elimina(n.id))}
            />
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  h2 {
    font-family: var(--font-titoli);
  }
  h3 {
    font-size: 1rem;
    margin: 1.2rem 0 0.5rem;
  }
  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    font-style: italic;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    background: var(--sfondo);
    color: var(--testo);
    resize: vertical;
  }
  .tenue {
    color: var(--testo-tenue);
    font-size: 0.85rem;
  }
  #conteggio {
    margin: 0.2rem 0 0.5rem;
    text-align: right;
    font-family: var(--font-mono);
  }
  .azioni,
  .riga {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
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
    margin: 0;
    display: grid;
    gap: 0.4rem;
    max-height: 22rem;
    overflow-y: auto;
  }
  li {
    padding: 0.5rem 0.65rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  li.mostrato {
    border-left: 4px solid var(--accento);
  }
  .testo {
    margin: 0 0 0.3rem;
    font-style: italic;
    white-space: pre-line;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
