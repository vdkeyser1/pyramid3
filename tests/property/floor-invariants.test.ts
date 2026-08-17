/**
 * Property test delle invarianti di generazione.
 * Esecuzione: 100 run in locale, 1.000 in PR, 10.000 su main, 100.000 in nightly.
 *
 * Ogni seed che fallisce va aggiunto a tests/fixtures/regression-seeds.json.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { createSeedRngFactory } from '@/procedural/SeedRng.js';
import { validateFloor, graphDistance } from '@/procedural/FloorValidator.js';
import type { FloorModel, ValidationLimits } from '@/procedural/FloorValidator.js';
import { FLOOR_CONSTRAINTS, PLAYER } from '@/content/balance.js';
import regressionSeeds from '../fixtures/regression-seeds.json' with { type: 'json' };

import { generateFloor } from '@/procedural/FloorGenerator.js';

const GENERATION_VERSION = 1;

const RUNS = Number(process.env.PROPERTY_RUNS ?? 100);

const LIMITS: ValidationLimits = {
  minPlayerClearanceM: PLAYER.capsuleRadiusM * 2,
  mapToTreasureMinGraphDistance: FLOOR_CONSTRAINTS.mapToTreasureMinGraphDistance,
  mapToTreasureMaxGraphDistance: FLOOR_CONSTRAINTS.mapToTreasureMaxGraphDistance,
};

const buildFloor = (seed: number): FloorModel =>
  generateFloor({ seed, generationVersion: GENERATION_VERSION, isTutorial: false, floorIndex: 1 });

describe('invarianti del piano', () => {
  it('nessuna violazione bloccante su seed arbitrari', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0x7fffffff }), (seed: number) => {
        const result = validateFloor(buildFloor(seed), LIMITS);
        if (!result.ok) {
          const blocking = result.error.filter((v) => v.severity === 'BLOCKING');
          throw new Error(
            `seed ${seed}: ${blocking.map((v) => `${v.code} ${v.message}`).join(' | ')}`,
          );
        }
        return true;
      }),
      { numRuns: RUNS },
    );
  });

  it('il tesoro non è mai nella stanza della mappa ed è raggiungibile', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0x7fffffff }), (seed: number) => {
        const floor = buildFloor(seed);
        expect(floor.treasureRoomId).not.toBe(floor.mapRoomId);
        expect(graphDistance(floor.rooms, floor.mapRoomId, floor.treasureRoomId)).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: RUNS },
    );
  });

  it('stesso seed e stessa versione producono lo stesso piano', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0x7fffffff }), (seed: number) => {
        expect(JSON.stringify(buildFloor(seed))).toBe(JSON.stringify(buildFloor(seed)));
        return true;
      }),
      { numRuns: Math.min(RUNS, 1_000) },
    );
  });

  it('i canali RNG sono indipendenti fra loro (regressione MIG-11)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0x7fffffff }), (seed: number) => {
        const factory = createSeedRngFactory(seed, GENERATION_VERSION);

        const topologyReference = Array.from({ length: 8 }, () =>
          factory.forChannel('topology').next(),
        );

        const decor = factory.forChannel('decor');
        for (let i = 0; i < 137; i++) decor.next();

        const topologyAfter = Array.from({ length: 8 }, () =>
          factory.forChannel('topology').next(),
        );

        expect(topologyAfter).toStrictEqual(topologyReference);
        return true;
      }),
      { numRuns: Math.min(RUNS, 1_000) },
    );
  });

  it('il corpus di regressione resta verde', () => {
    for (const seed of regressionSeeds as readonly number[]) {
      const result = validateFloor(buildFloor(seed), LIMITS);
      expect(result.ok, `seed di regressione ${seed}`).toBe(true);
    }
  });
});
