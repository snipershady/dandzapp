/**
 * Geometria delle zone (RF-20, RF-44). I percorsi delle zone sono fatti solo di comandi
 * M, L e Z con coordinate assolute (lo garantisce lo schema di `avventura.json`).
 */

type Punto = readonly [number, number];

/** Poligoni di un percorso SVG M/L/Z: ogni M inizia un nuovo poligono. */
export function poligoni(percorso: string): Punto[][] {
  const risultato: Punto[][] = [];
  let corrente: Punto[] = [];
  for (const [, comando, numeri] of percorso.matchAll(/([MLZ])([^MLZ]*)/g)) {
    if (comando === 'M' && corrente.length > 0) {
      risultato.push(corrente);
      corrente = [];
    }
    const valori = (numeri ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    for (let i = 0; i + 1 < valori.length; i += 2) {
      corrente.push([valori[i] ?? 0, valori[i + 1] ?? 0]);
    }
  }
  if (corrente.length > 0) risultato.push(corrente);
  return risultato;
}

/** Punto dentro un poligono (regola pari-dispari, "ray casting"). */
function dentroPoligono([x, y]: Punto, poligono: Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i] ?? [0, 0];
    const [xj, yj] = poligono[j] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Il punto sta dentro il percorso (in uno qualsiasi dei suoi poligoni)? */
export function dentroPercorso(punto: Punto, percorso: string): boolean {
  return poligoni(percorso).some((p) => dentroPoligono(punto, p));
}

/** Prima zona che contiene il punto, o `undefined` se il punto è fuori da ogni zona. */
export function zonaDi<Z extends { percorso: string }>(zone: Z[], punto: Punto): Z | undefined {
  return zone.find((z) => dentroPercorso(punto, z.percorso));
}
