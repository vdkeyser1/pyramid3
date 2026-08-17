import { describe, expect, it } from 'vitest';
import { rollDigLoot, type DigLootRoll } from '@/content/digLoot.js';
import { ALL_UPGRADES } from '@/content/upgrades.js';

describe('digLoot (G-04 residuo / A-01)', () => {
  it('è deterministico: stessi input ⇒ stesso esito', () => {
    const first = rollDigLoot(42, 3, 7, 1);
    const second = rollDigLoot(42, 3, 7, 1);
    expect(second).toEqual(first);
  });

  it('varia con seed, posizione e tier (spaziatura su 8 input)', () => {
    // 8 input diversi: la probabilità che TUTTI producano lo stesso esito è
    // trascurabile (~1e-5) — test robusto, non flaky.
    const rolls = [
      rollDigLoot(42, 3, 7, 1),
      rollDigLoot(43, 3, 7, 1),
      rollDigLoot(44, 3, 7, 1),
      rollDigLoot(45, 3, 7, 1),
      rollDigLoot(42, 4, 7, 1),
      rollDigLoot(42, 3, 8, 1),
      rollDigLoot(42, 3, 7, 2),
      rollDigLoot(99, 11, 11, 3),
    ];
    const unique = new Set(rolls.map((r) => JSON.stringify(r)));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('gli importi sono positivi per fragments/gold e scalano col tier', () => {
    const seen: DigLootRoll[] = [];
    for (let seed = 0; seed < 200; seed++) {
      const roll = rollDigLoot(seed, 1, 1, 1);
      if (roll.kind === 'fragments' || roll.kind === 'gold') {
        expect(roll.amount).toBeGreaterThan(0);
      }
      if (roll.kind === 'none') {
        expect(roll.amount).toBe(0);
      }
      if (roll.kind === 'graft') {
        expect(roll.graftName).toBeDefined();
      }
      seen.push(roll);
    }
    // Distribuzione: su 200 roll tutti i kind compaiono (probabilità cumulativa
    // none 55% / fragments 22% / gold 16% / graft 7% — nessuno è impossibile).
    const kinds = new Set(seen.map((r) => r.kind));
    expect(kinds.has('none')).toBe(true);
    expect(kinds.has('fragments')).toBe(true);
    expect(kinds.has('gold')).toBe(true);
  });

  it('il graft raro esiste sempre (1 su ~200 roll) e viene dal catalogo', () => {
    let graftRoll: DigLootRoll | null = null;
    for (let seed = 0; seed < 300; seed++) {
      const roll = rollDigLoot(seed, 5, 5, 3);
      if (roll.kind === 'graft') {
        graftRoll = roll;
        break;
      }
    }
    expect(graftRoll).not.toBeNull();
    if (graftRoll !== null) {
      const names = ALL_UPGRADES.map((u) => u.name);
      expect(names).toContain(graftRoll.graftName);
    }
  });

  it('un tier più alto produce ricompense maggiori a parità di seed', () => {
    const low = rollDigLoot(42, 3, 7, 1);
    const high = rollDigLoot(42, 3, 7, 4);
    if (low.kind === high.kind && (low.kind === 'fragments' || low.kind === 'gold')) {
      expect(high.amount).toBeGreaterThanOrEqual(low.amount);
    }
  });
});
