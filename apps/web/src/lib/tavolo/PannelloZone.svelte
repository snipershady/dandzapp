<script lang="ts">
  import type { ComandoZona, RispostaComando, ZonaPartita } from '@dandzapp/shared';
  import { SvelteMap } from 'svelte/reactivity';

  /**
   * Pannello del Master (RF-22): una casella per zona. Spuntarla scopre la zona per tutti,
   * togliere la spunta la ricopre.
   */
  let {
    zone,
    disabilitato = false,
    imposta,
    onerrore,
  }: {
    zone: ZonaPartita[];
    disabilitato?: boolean;
    imposta: (comando: ComandoZona) => Promise<RispostaComando>;
    onerrore: (messaggio: string) => void;
  } = $props();

  /** Scelte inviate e non ancora arrivate con lo stato della partita. */
  const inviate = new SvelteMap<string, boolean>();
  $effect(() => {
    for (const z of zone) if (inviate.get(z.id) === z.scoperta) inviate.delete(z.id);
  });

  const scoperte = $derived(zone.filter((z) => inviate.get(z.id) ?? z.scoperta).length);

  async function cambia(zona: ZonaPartita, scoperta: boolean): Promise<void> {
    inviate.set(zona.id, scoperta);
    const r = await imposta({ zonaId: zona.id, scoperta });
    if (!r.ok) {
      inviate.delete(zona.id);
      onerrore(r.errore);
    }
  }
</script>

<section aria-labelledby="zone">
  <h2 id="zone">Zone</h2>
  <p class="tenue">Scoperte {scoperte} di {zone.length}. Le vedono tutti al tavolo.</p>
  <ul>
    {#each zone as z (z.id)}
      <li>
        <label>
          <input
            type="checkbox"
            checked={inviate.get(z.id) ?? z.scoperta}
            disabled={disabilitato}
            onchange={(e) => cambia(z, e.currentTarget.checked)}
          />
          {z.nome}
        </label>
      </li>
    {/each}
  </ul>
</section>

<style>
  h2 {
    font-family: var(--font-titoli);
  }
  .tenue {
    color: var(--testo-tenue);
    margin-top: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.25rem;
  }
  label {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.35rem 0.5rem;
    border-radius: 0.4rem;
    cursor: pointer;
  }
  label:hover {
    background: var(--superficie);
  }
  input {
    width: 1.15rem;
    height: 1.15rem;
    accent-color: var(--accento);
  }
</style>
