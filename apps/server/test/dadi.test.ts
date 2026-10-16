import { FACCE } from '@dandzapp/shared';
import { describe, expect, it } from 'vitest';
import { tiraDado } from '../src/partite/tiri.ts';

describe('dadi (RF-52)', () => {
  it('ogni dado dà valori da 1 al numero di facce, tutti possibili', () => {
    for (const facce of FACCE) {
      const visti = new Set<number>();
      for (let i = 0; i < facce * 60; i++) {
        const v = tiraDado(facce);
        expect(Number.isInteger(v) && v >= 1 && v <= facce).toBe(true);
        visti.add(v);
      }
      expect(visti.size).toBe(facce);
    }
  });

  it('il d20 non è distorto (chi quadro su 100.000 tiri)', () => {
    const conteggi = new Array<number>(20).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) conteggi[tiraDado(20) - 1]! += 1;
    const atteso = n / 20;
    const chi2 = conteggi.reduce((s, c) => s + (c - atteso) ** 2 / atteso, 0);
    // 19 gradi di libertà: un dado giusto supera 55 circa una volta su 100.000. Una
    // distorsione vera (es. il 6% in più su alcune facce, come col modulo) darebbe centinaia.
    expect(chi2).toBeLessThan(55);
  });
});
