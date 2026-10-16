import type { Tiro } from '@dandzapp/shared';

/** Formula di un tiro: "1d20+2", "3d6", "2d8-1". */
export function formula({
  numero,
  facce,
  modificatore,
}: Pick<Tiro, 'numero' | 'facce' | 'modificatore'>) {
  const mod = modificatore > 0 ? `+${modificatore}` : modificatore < 0 ? `${modificatore}` : '';
  return `${numero}d${facce}${mod}`;
}

/** 20 o 1 naturale su un d20 singolo (RF-53). */
export function naturale(t: Pick<Tiro, 'numero' | 'facce' | 'risultati'>): 'venti' | 'uno' | null {
  if (t.numero !== 1 || t.facce !== 20) return null;
  if (t.risultati[0] === 20) return 'venti';
  if (t.risultati[0] === 1) return 'uno';
  return null;
}

/** Ora del tiro, nel formato locale (es. 21:34:05). */
export const ora = (iso: string) =>
  new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
