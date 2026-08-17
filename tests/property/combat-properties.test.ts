/**
 * Property-based tests per combattimento, RNG e invarianti critiche.
 * Usa fast-check con 100 run (local), scalabile a 1k/10k/100k in CI via PROPERTY_RUNS.
 */
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { resolveDamage, type DamageInput } from '@/gameplay/combat/DamageResolver.js';
import { COMBAT } from '@/content/balance.js';
import { createSeedRngFactory, RNG_CHANNELS } from '@/procedural/SeedRng.js';

const NUM_RUNS = Number(process.env.PROPERTY_RUNS ?? 100);

// ── Arbitrary per DamageInput ──

const arbDamageInput: fc.Arbitrary<DamageInput> = fc.record({
  baseDamageHp: fc.float({ min: 0, max: 500, noNaN: true }),
  attackModifier: fc.float({ min: 0, max: 5, noNaN: true }),
  sourceModifier: fc.float({ min: 0, max: 5, noNaN: true }),
  targetArmor: fc.float({ min: 0, max: 1.5, noNaN: true }),
  resistanceMultiplier: fc.float({ min: 0, max: 3, noNaN: true }),
  isCritical: fc.boolean(),
  criticalMultiplier: fc.float({ min: 1, max: 4, noNaN: true }),
});

describe('DamageResolver — proprietà', () => {
  it('danno finale ≥ minimumDamageHp quando raw > 0 (tutti i moltiplicatori positivi)', () => {
    fc.assert(
      fc.property(arbDamageInput, (input) => {
        // raw = base * attackMod * sourceMod * critical
        // Se uno qualsiasi è 0, raw = 0 e finalDamage = 0 è corretto.
        if (input.baseDamageHp <= 0 || input.attackModifier <= 0 || input.sourceModifier <= 0) {
          return true;
        }
        const out = resolveDamage(input);
        return out.finalDamageHp >= COMBAT.minimumDamageHp;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('armor cap mai superato', () => {
    fc.assert(
      fc.property(arbDamageInput, (input) => {
        const out = resolveDamage(input);
        return out.appliedArmor <= COMBAT.armorCap;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('danno finale non negativo', () => {
    fc.assert(
      fc.property(arbDamageInput, (input) => {
        const out = resolveDamage(input);
        return out.finalDamageHp >= 0;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('stessi input → stesso output (determinismo)', () => {
    fc.assert(
      fc.property(arbDamageInput, (input) => {
        const a = resolveDamage(input);
        const b = resolveDamage(input);
        return (
          a.finalDamageHp === b.finalDamageHp &&
          a.mitigatedHp === b.mitigatedHp &&
          a.appliedArmor === b.appliedArmor &&
          a.wasCritical === b.wasCritical
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('critico ≥ non critico a parità di input', () => {
    fc.assert(
      fc.property(arbDamageInput, (input) => {
        if (input.baseDamageHp <= 0) return true;
        const normal = resolveDamage({ ...input, isCritical: false });
        const crit = resolveDamage({ ...input, isCritical: true, criticalMultiplier: 2 });
        return crit.finalDamageHp >= normal.finalDamageHp;
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('SeedRng — proprietà', () => {
  it('canali indipendenti: consumare N numeri in un canale non altera gli altri', () => {
    fc.assert(
      fc.property(
        fc.nat(0xFFFFFFFF),
        fc.nat(10),
        (seed, consumeCount) => {
          const factory1 = createSeedRngFactory(seed, 1);
          const factory2 = createSeedRngFactory(seed, 1);

          // In factory1, consumiamo N numeri dal canale 'topology'
          const topo1 = factory1.forChannel('topology');
          for (let i = 0; i < consumeCount; i++) topo1.next();

          // Poi leggiamo 'loot' da entrambe le factory
          const loot1 = factory1.forChannel('loot');
          const loot2 = factory2.forChannel('loot');

          // Devono produrre la stessa sequenza
          for (let i = 0; i < 10; i++) {
            if (loot1.next() !== loot2.next()) return false;
          }
          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('stessa coppia (seed, version) → stessa sequenza per ogni canale', () => {
    fc.assert(
      fc.property(
        fc.nat(0xFFFFFFFF),
        fc.constantFrom(...RNG_CHANNELS),
        (seed, channel) => {
          const f1 = createSeedRngFactory(seed, 1);
          const f2 = createSeedRngFactory(seed, 1);
          const r1 = f1.forChannel(channel);
          const r2 = f2.forChannel(channel);

          for (let i = 0; i < 20; i++) {
            if (r1.next() !== r2.next()) return false;
          }
          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('semi diversi → sequenze diverse (con alta probabilità)', () => {
    fc.assert(
      fc.property(
        fc.nat(0x7FFFFFFF),
        (seed) => {
          const f1 = createSeedRngFactory(seed, 1);
          const f2 = createSeedRngFactory(seed + 1, 1);
          const r1 = f1.forChannel('topology');
          const r2 = f2.forChannel('topology');

          // Almeno un valore diverso nei primi 10
          let allSame = true;
          for (let i = 0; i < 10; i++) {
            if (r1.next() !== r2.next()) allSame = false;
          }
          return !allSame;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('next() produce valori in [0, 1)', () => {
    fc.assert(
      fc.property(
        fc.nat(0xFFFFFFFF),
        (seed) => {
          const rng = createSeedRngFactory(seed, 1).forChannel('topology');
          for (let i = 0; i < 100; i++) {
            const v = rng.next();
            if (v < 0 || v >= 1) return false;
          }
          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('int(min, max) produce valori in [min, max)', () => {
    fc.assert(
      fc.property(
        fc.nat(0xFFFFFFFF),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (seed, min, range) => {
          const max = min + range;
          const rng = createSeedRngFactory(seed, 1).forChannel('encounters');
          for (let i = 0; i < 50; i++) {
            const v = rng.int(min, max);
            if (v < min || v >= max) return false;
          }
          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('shuffle preserva gli elementi', () => {
    fc.assert(
      fc.property(
        fc.nat(0xFFFFFFFF),
        fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
        (seed, arr) => {
          const rng = createSeedRngFactory(seed, 1).forChannel('loot');
          const shuffled = rng.shuffle(arr);
          if (shuffled.length !== arr.length) return false;
          return arr.slice().sort().join(',') === shuffled.slice().sort().join(',');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
