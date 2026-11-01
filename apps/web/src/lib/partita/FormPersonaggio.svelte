<script lang="ts">
  import { untrack } from 'svelte';
  import type { CorpoPersonaggio, Partecipante, Personaggio } from '@dandzapp/shared';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import Selettore from '#lib/componenti/Selettore.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';

  let {
    iniziale,
    coloreSuggerito = '#1f4f8f',
    giocatori,
    testoSalva,
    onsalva,
    onannulla,
  }: {
    iniziale?: Personaggio;
    coloreSuggerito?: string;
    giocatori: Partecipante[];
    testoSalva: string;
    onsalva: (dati: CorpoPersonaggio) => Promise<unknown>;
    onannulla?: () => void;
  } = $props();

  // Valori di partenza del modulo: non seguono le modifiche successive delle props.
  const partenza = untrack(() => ({ iniziale, coloreSuggerito }));
  let nome = $state(partenza.iniziale?.nome ?? '');
  let classe = $state(partenza.iniziale?.classe ?? '');
  let sigla = $state(partenza.iniziale?.sigla ?? '');
  let colore = $state(partenza.iniziale?.colore ?? partenza.coloreSuggerito);
  let utenteId = $state<number | null>(partenza.iniziale?.utenteId ?? null);
  let siglaToccata = $state(Boolean(partenza.iniziale));
  const modulo = new StatoModulo();

  // Sigla proposta dalle prime due lettere del nome, finché non la si scrive a mano.
  $effect(() => {
    if (!siglaToccata) {
      const lettere = nome.replace(/[^A-Za-zÀ-ÿ]/g, '');
      sigla = lettere.slice(0, 1).toUpperCase() + lettere.slice(1, 2).toLowerCase();
    }
  });

  async function salva(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    const ok = await modulo.invia(() => onsalva({ nome, classe, sigla, colore, utenteId }));
    if (ok && !iniziale) {
      nome = '';
      classe = '';
      utenteId = null;
      siglaToccata = false;
    }
  }

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
  const CLASSI = ['Guerriero', 'Chierico', 'Mago', 'Ladro', 'Nano', 'Elfo', 'Halfling'];
  const idClassi = $props.id();
</script>

<form class="form-pg" onsubmit={salva} novalidate>
  {#if modulo.errore && Object.keys(modulo.campi).length === 0}<Avviso>{modulo.errore}</Avviso>{/if}
  <div class="campi">
    <Campo
      etichetta="Nome"
      name="nome"
      required
      maxlength={60}
      bind:value={nome}
      errore={modulo.campi['nome']}
    />
    <Campo
      etichetta="Classe"
      name="classe"
      maxlength={40}
      list={idClassi}
      bind:value={classe}
      errore={modulo.campi['classe']}
    />
    <Campo
      etichetta="Sigla"
      name="sigla"
      required
      maxlength={3}
      aiuto="1–3 lettere sulla pedina."
      bind:value={sigla}
      oninput={() => (siglaToccata = true)}
      errore={modulo.campi['sigla']}
    />
    <fieldset class="colore">
      <legend>Colore</legend>
      <div class="tavolozza">
        {#each TAVOLOZZA as c (c)}
          <label class="campione" style:background={c}>
            <input type="radio" name="colore-{idClassi}" value={c} bind:group={colore} />
            <span class="visually-hidden">{c}</span>
          </label>
        {/each}
        <input
          class="libero"
          type="color"
          name="colore"
          aria-label="Colore personalizzato"
          bind:value={colore}
        />
      </div>
      {#if modulo.campi['colore']}<p class="errore">{modulo.campi['colore']}</p>{/if}
    </fieldset>
    <Selettore etichetta="Giocatore" bind:value={utenteId} errore={modulo.campi['utenteId']}>
      <option value={null}>Nessuno</option>
      {#each giocatori as g (g.utenteId)}
        <option value={g.utenteId}>{g.nome}</option>
      {/each}
    </Selettore>
  </div>
  <datalist id={idClassi}>
    {#each CLASSI as c (c)}<option value={c}></option>{/each}
  </datalist>
  <div class="azioni">
    <button class="salva" type="submit" disabled={modulo.inInvio}>{testoSalva}</button>
    {#if onannulla}<button type="button" onclick={onannulla}>Annulla</button>{/if}
  </div>
</form>

<style>
  .campi {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0 1rem;
  }
  .azioni {
    display: flex;
    gap: 0.5rem;
  }
  .salva {
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
    font-weight: 700;
  }
  .colore {
    border: 0;
    padding: 0;
    margin: 0 0 1rem;
    min-width: 0;
  }
  legend {
    font-weight: 600;
    padding: 0;
    margin-bottom: 0.3rem;
  }
  .tavolozza {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .campione {
    position: relative;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 2px solid rgb(0 0 0 / 0.35);
    cursor: pointer;
  }
  .campione input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .campione:has(input:checked) {
    outline: 3px solid var(--testo);
    outline-offset: 2px;
  }
  .campione:has(input:focus-visible) {
    outline: 3px solid var(--accento);
    outline-offset: 2px;
  }
  .libero {
    width: 2.4rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--bordo);
    border-radius: 0.4rem;
    background: none;
    cursor: pointer;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .errore {
    margin: 0.3rem 0 0;
    font-size: 0.9rem;
    color: var(--errore);
  }
</style>
