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
    <Campo
      etichetta="Colore"
      name="colore"
      type="color"
      bind:value={colore}
      errore={modulo.campi['colore']}
    />
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
  :global(.form-pg input[type='color']) {
    padding: 0.15rem;
    height: 2.6rem;
  }
</style>
