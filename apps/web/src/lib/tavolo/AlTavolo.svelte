<script lang="ts">
  import type { Personaggio, PresenteAlTavolo } from '@dandzapp/shared';

  /** Chi ha la pagina della partita aperta in questo momento (RF-80). */
  let {
    presenti,
    personaggi,
    io,
  }: { presenti: PresenteAlTavolo[]; personaggi: Personaggio[]; io: number } = $props();

  const ETICHETTE = { master: 'Master', giocatore: 'gioca', osservatore: 'sola lettura' } as const;
  const pg = (id: number | null) => personaggi.find((p) => p.id === id);
</script>

<section aria-labelledby="al-tavolo">
  <h2 id="al-tavolo">Al tavolo</h2>
  {#if presenti.length}
    <ul>
      {#each presenti as p (p.utenteId)}
        <li aria-label={p.nome}>
          {#if p.avatarUrl}
            <img src={p.avatarUrl} alt="" width="32" height="32" />
          {:else}
            <span class="avatar" aria-hidden="true">{p.nome.slice(0, 1).toUpperCase()}</span>
          {/if}
          <span class="chi">
            <strong>{p.nome}</strong>{#if p.utenteId === io}<span class="tenue"> (tu)</span>{/if}
            {#if pg(p.personaggioId)}<span class="tenue pg">{pg(p.personaggioId)?.nome}</span>{/if}
          </span>
          <span class="etichetta {p.ruolo}">{ETICHETTE[p.ruolo]}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="tenue">Nessuno collegato.</p>
  {/if}
</section>

<style>
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.75rem;
    background: var(--superficie);
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
  }
  .avatar,
  img {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    flex: none;
  }
  .avatar {
    display: grid;
    place-items: center;
    background: var(--bordo);
    font-weight: 700;
  }
  .chi {
    display: grid;
    margin-right: auto;
  }
  .pg {
    font-size: 0.9rem;
  }
  .tenue {
    color: var(--testo-tenue);
  }
  .etichetta {
    font-size: 0.8rem;
    padding: 0.05rem 0.5rem;
    border-radius: 1rem;
    border: 1px solid var(--bordo);
    white-space: nowrap;
  }
  .etichetta.master {
    background: var(--accento);
    border-color: var(--accento);
    color: var(--su-accento);
  }
  .etichetta.osservatore {
    color: var(--errore);
    border-color: var(--errore);
  }
</style>
