<script lang="ts">
  import type {
    ComandoSpostaPedina,
    MappaPartita,
    Personaggio,
    RispostaComando,
    ZonaPartita,
  } from '@dandzapp/shared';
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  /**
   * Il tavolo: mappa in SVG nelle coordinate dell'immagine (RF-10, RF-12) con le pedine
   * dei PG (RF-30…RF-33). Le pedine si trascinano con mouse o dito, o si muovono con le
   * frecce da tastiera; la posizione si salva al rilascio (RF-94).
   */
  let {
    partitaId,
    mappa,
    personaggi,
    zone,
    mioPersonaggioId,
    puoMuovere,
    sposta,
    onerrore,
  }: {
    partitaId: number;
    mappa: MappaPartita;
    personaggi: Personaggio[];
    /** Solo per il Master: le zone, per la nebbia in trasparenza (RF-21). */
    zone?: ZonaPartita[] | undefined;
    /** PG scelto con "Giochi come": la sua pedina ha il bordo dorato (RF-32). */
    mioPersonaggioId: number | null;
    puoMuovere: boolean;
    sposta: (comando: ComandoSpostaPedina) => Promise<RispostaComando>;
    onerrore: (messaggio: string) => void;
  } = $props();

  const W = $derived(mappa.larghezza);
  const H = $derived(mappa.altezza);
  const Q = $derived(mappa.quadretto.px);

  let svg = $state<SVGSVGElement>();

  /**
   * Quando cambia la mappa (una zona scoperta) la nuova immagine si scarica prima di
   * mostrarla: niente lampo di nebbia mentre arriva.
   */
  const urlMappa = $derived(`/api/partite/${partitaId}/mappa?k=${mappa.chiave}`);
  let urlMostrato = $state(untrack(() => urlMappa));
  $effect(() => {
    const url = urlMappa;
    if (url === untrack(() => urlMostrato)) return;
    const immagine = new Image();
    immagine.onload = immagine.onerror = () => {
      if (urlMappa === url) urlMostrato = url;
    };
    immagine.src = url;
  });
  const coperte = $derived((zone ?? []).filter((z) => !z.scoperta));
  /** Larghezza a schermo della mappa, per tenere le pedine leggibili anche sul telefono. */
  let larghezzaSchermo = $state(0);
  const scala = $derived(larghezzaSchermo > 0 ? larghezzaSchermo / W : 1);
  /** Raggio in coordinate mappa: ~0,4 quadretti, ma mai meno di 9 px sullo schermo. */
  const raggio = $derived(Math.max(Q * 0.42, 9 / scala));

  /** Pedina che si sta trascinando: gli aggiornamenti in arrivo per lei si ignorano (RF-94). */
  let trascinata = $state<{
    id: number;
    pointerId: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  /** Posizioni rilasciate e non ancora confermate dal server. */
  const inAttesa = new SvelteMap<number, { x: number; y: number }>();

  function posizione(pg: Personaggio): { x: number; y: number } {
    if (trascinata?.id === pg.id) return trascinata;
    return inAttesa.get(pg.id) ?? pg;
  }

  // La pedina trascinata e la propria stanno sopra le altre.
  const ordinate = $derived(
    [...personaggi].sort(
      (a, b) =>
        Number(a.id === trascinata?.id) - Number(b.id === trascinata?.id) ||
        Number(a.id === mioPersonaggioId) - Number(b.id === mioPersonaggioId),
    ),
  );

  const limita = (v: number, max: number) => Math.min(Math.max(v, 0), max);

  /** Punto del puntatore in coordinate mappa. */
  function punto(e: PointerEvent): { x: number; y: number } | null {
    const m = svg?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  function inizia(e: PointerEvent, pg: Personaggio): void {
    if (!puoMuovere || trascinata || e.button !== 0) return;
    const p = punto(e);
    if (!p) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const da = posizione(pg);
    trascinata = { id: pg.id, pointerId: e.pointerId, ...da, dx: p.x - da.x, dy: p.y - da.y };
  }

  function muovi(e: PointerEvent): void {
    if (!trascinata || e.pointerId !== trascinata.pointerId) return;
    const p = punto(e);
    if (!p) return;
    trascinata.x = limita(p.x - trascinata.dx, W);
    trascinata.y = limita(p.y - trascinata.dy, H);
  }

  function rilascia(e: PointerEvent): void {
    if (!trascinata || e.pointerId !== trascinata.pointerId) return;
    const { id, x, y } = trascinata;
    trascinata = null;
    const pg = personaggi.find((p) => p.id === id);
    if (pg && Math.hypot(pg.x - x, pg.y - y) < 1) return;
    void salva(id, x, y);
  }

  function annulla(e: PointerEvent): void {
    if (trascinata?.pointerId === e.pointerId) trascinata = null;
  }

  /** Con le frecce la pedina si sposta di un quadretto (RNF-04). */
  function tasto(e: KeyboardEvent, pg: Personaggio): void {
    const passi: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const passo = passi[e.key];
    if (!puoMuovere || !passo) return;
    e.preventDefault();
    const da = posizione(pg);
    void salva(pg.id, limita(da.x + passo[0] * Q, W), limita(da.y + passo[1] * Q, H));
  }

  async function salva(id: number, x: number, y: number): Promise<void> {
    // Fino alla risposta la pedina resta dove l'ha lasciata l'utente; poi vale la
    // posizione salvata, arrivata con l'evento del server (RF-94).
    inAttesa.set(id, { x, y });
    const r = await sposta({ personaggioId: id, x: Math.round(x), y: Math.round(y) });
    if (inAttesa.get(id)?.x === x && inAttesa.get(id)?.y === y) inAttesa.delete(id);
    if (!r.ok) onerrore(r.errore);
  }

  const nomiPg = $derived(personaggi.map((p) => p.nome).join(', '));

  /**
   * Sul telefono un tocco che parte da una pedina non deve far scorrere la pagina, altrimenti
   * il browser annulla il trascinamento. `touch-action` non vale dentro un SVG, e Svelte
   * registra `ontouchstart` come passivo: serve un ascoltatore non passivo.
   */
  function bloccaScorrimento(nodo: SVGSVGElement) {
    const ferma = (e: TouchEvent) => {
      if (puoMuovere && (e.target as Element | null)?.closest('.pedina')) e.preventDefault();
    };
    nodo.addEventListener('touchstart', ferma, { passive: false });
    return () => nodo.removeEventListener('touchstart', ferma);
  }
</script>

<svg
  bind:this={svg}
  bind:clientWidth={larghezzaSchermo}
  {@attach bloccaScorrimento}
  class="mappa"
  class:muovibili={puoMuovere}
  viewBox="0 0 {W} {H}"
  role="group"
  aria-label="Mappa del dungeon"
  onpointermove={muovi}
  onpointerup={rilascia}
  onpointercancel={annulla}
>
  <desc>
    Mappa del dungeon vista dall'alto, con le zone esplorate. Pedine sulla mappa: {nomiPg ||
      'nessuna'}.
  </desc>
  <defs>
    <pattern id="griglia" width={Q} height={Q} patternUnits="userSpaceOnUse">
      <path d="M {Q} 0 L 0 0 0 {Q}" class="linea-griglia" />
    </pattern>
  </defs>
  <!-- Fuori dalle zone scoperte l'immagine è trasparente: sotto c'è la nebbia. -->
  <rect class="nebbia" width={W} height={H} />
  <rect width={W} height={H} fill="url(#griglia)" />
  <image href={urlMostrato} width={W} height={H} />
  <!-- Il Master vede le zone coperte in trasparenza; la nebbia non intercetta i clic (RF-25). -->
  <!-- L'opacità è del gruppo: dove due zone si sovrappongono la nebbia non si scurisce. -->
  <g class="nebbia-master">
    {#each coperte as z (z.id)}
      <path d={z.percorso} data-zona={z.id} />
    {/each}
  </g>

  {#each ordinate as pg (pg.id)}
    {@const p = posizione(pg)}
    {@const mio = pg.id === mioPersonaggioId}
    <!-- Il tabindex c'è solo quando la pedina si può muovere, cioè quando è un "button". -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <g
      class="pedina"
      class:mio
      class:trascinata={trascinata?.id === pg.id}
      transform="translate({p.x} {p.y})"
      role={puoMuovere ? 'button' : 'img'}
      tabindex={puoMuovere ? 0 : undefined}
      aria-label="{pg.nome}{mio ? ' (il tuo personaggio)' : ''}{puoMuovere
        ? ': trascina o usa le frecce per spostarla'
        : ''}"
      aria-roledescription="pedina"
      data-pedina={pg.sigla}
      onpointerdown={(e) => inizia(e, pg)}
      onkeydown={(e) => tasto(e, pg)}
    >
      <title>{pg.nome}</title>
      <circle r={raggio} fill={pg.colore} stroke-width={raggio * (mio ? 0.22 : 0.12)} />
      <text dy="0.35em" font-size={raggio * 0.85}>{pg.sigla}</text>
    </g>
  {/each}
</svg>

<!-- Scala grafica e nord (RF-10): fuori dalla mappa, così valgono anche nella nebbia. -->
<div class="riferimenti">
  <span class="nord" aria-label="Il nord è in alto"><span aria-hidden="true">▲</span> N</span>
  <span class="scala">
    <span class="barra" style:width="{2 * Q * scala}px" aria-hidden="true"></span>
    {2 * mappa.quadretto.metri} m · 1 quadretto = {mappa.quadretto.metri} m ({mappa.quadretto.piedi} ft)
  </span>
</div>

<style>
  .mappa {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--bordo);
    border-radius: 0.5rem;
    background: var(--nebbia);
    /* Sul telefono il trascinamento non deve far scorrere la pagina. */
    user-select: none;
    -webkit-user-select: none;
  }
  .nebbia {
    fill: var(--nebbia);
  }
  .riferimenti {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    margin-top: 0.35rem;
    font-size: 0.85rem;
    color: var(--testo-tenue);
  }
  .nord {
    font-family: var(--font-titoli);
  }
  .scala {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
  }
  .barra {
    display: inline-block;
    height: 0.4rem;
    border: 1px solid var(--testo);
    background: linear-gradient(to right, var(--testo) 50%, transparent 50%);
  }
  .nebbia-master {
    fill: var(--nebbia);
    opacity: 0.55;
    pointer-events: none;
  }
  .linea-griglia {
    fill: none;
    stroke: var(--nebbia-griglia);
    stroke-width: 1;
  }
  .pedina circle {
    stroke: rgb(0 0 0 / 0.55);
  }
  .pedina.mio circle {
    stroke: var(--oro);
  }
  .pedina text {
    fill: #fff;
    text-anchor: middle;
    font-family: var(--font-mono);
    font-weight: 700;
    pointer-events: none;
  }
  .muovibili .pedina {
    cursor: grab;
    touch-action: none;
  }
  .muovibili .pedina.trascinata {
    cursor: grabbing;
  }
  .pedina:focus {
    outline: none;
  }
  .pedina:focus-visible circle {
    stroke: var(--accento);
  }
  .pedina.trascinata circle {
    filter: drop-shadow(0 0.15em 0.2em rgb(0 0 0 / 0.5));
  }
</style>
