<script lang="ts">
  /** Pedina tonda del PG con colore e sigla (RF-30), in piccolo per gli elenchi. */
  let { colore, sigla, nome }: { colore: string; sigla: string; nome: string } = $props();
</script>

<span class="pedina" style:background={colore} title={nome} aria-hidden="true">{sigla}</span>

<style>
  .pedina {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    border: 2px solid rgb(0 0 0 / 0.35);
    flex: none;
  }
</style>
