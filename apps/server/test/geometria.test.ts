import { readFile } from 'node:fs/promises';
import { DefinizioneAvventura, dentroPercorso, poligoni, zonaDi } from '@dandzapp/shared';
import { describe, expect, it } from 'vitest';
import { prefissoDa, raggruppa } from '../src/partite/mostri.ts';

const sessione0 = DefinizioneAvventura.parse(
  JSON.parse(
    await readFile(
      new URL('../../../avventure/sessione-0/avventura.json', import.meta.url),
      'utf8',
    ),
  ),
);
const zona = (id: string) => {
  const z = sessione0.zone.find((x) => x.id === id);
  if (!z) throw new Error(`zona ${id} assente`);
  return z;
};

describe('geometria delle zone', () => {
  it('legge i poligoni di un percorso M/L/Z', () => {
    expect(poligoni('M0,0 L10,0 L10,10 Z M20,20 L30,20 L30,30 Z')).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [
        [20, 20],
        [30, 20],
        [30, 30],
      ],
    ]);
  });

  it('riconosce i punti dentro e fuori', () => {
    const quadrato = 'M0,0 L10,0 L10,10 L0,10 Z';
    expect(dentroPercorso([5, 5], quadrato)).toBe(true);
    expect(dentroPercorso([15, 5], quadrato)).toBe(false);
    expect(dentroPercorso([-1, -1], quadrato)).toBe(false);
  });

  it('il centro di ogni zona della Sessione 0 sta nella sua zona', () => {
    for (const z of sessione0.zone) expect(zonaDi(sessione0.zone, z.centro)?.id).toBeDefined();
    expect(zonaDi(sessione0.zone, [380, 192])?.id).toBe('sala3');
    // Nella roccia, fuori da ogni zona.
    expect(zonaDi(sessione0.zone, [100, 100])).toBeUndefined();
  });
});

describe('mostri', () => {
  it('compaiono raggruppati dentro la zona, anche in un corridoio stretto (RF-41)', () => {
    for (const id of ['sala1', 'corr_nord', 'passaggio', 'cunicolo']) {
      const posizioni = raggruppa(zona(id), 12, 40);
      expect(posizioni).toHaveLength(12);
      for (const p of posizioni) expect(dentroPercorso([p.x, p.y], zona(id).percorso)).toBe(true);
    }
  });

  it('la sigla di un nome libero sono le sue prime due lettere', () => {
    expect(prefissoDa('Bandito')).toBe('Ba');
    expect(prefissoDa('élfo oscuro')).toBe('Él');
    expect(prefissoDa('3 orchi')).toBe('Or');
    expect(prefissoDa('!!!')).toBe('Mo');
  });
});
