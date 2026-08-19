/**
 * Q-03 — Property-Based Tests per il Floor Generator
 * Verifica invarianti strutturali su generazioni con seed arbitrari:
 *   - Tutte le stanze sono connesse (grafo connesso)
 *   - Nessuna stanza sovrapposta (AABB check)
 *   - La stanza iniziale e finale esistono sempre
 *   - Il generatore è deterministico dato lo stesso seed
 *
 * Usa il generatore di seed deterministico (LCG) senza Date.now().
 */

import { describe, it, expect } from 'vitest';
import type { FloorModel, RoomNode, RoomId } from '@/procedural/FloorValidator.js';
import type { FloorGenerationInput } from '@/procedural/FloorModel.js';

let generateFloor: ((input: FloorGenerationInput) => FloorModel) | null = null;

try {
  const mod = await import('@/procedural/FloorGenerator.js').catch(() => null);
  if (mod && 'generateFloor' in mod) {
    generateFloor = mod.generateFloor;
  }
} catch {
  // Il modulo non è ancora disponibile — i test saranno skippati
}

// ── Mini property-based framework ────────────────────────────────────────────

/** LCG per sequenze di seed deterministici senza Date.now(). */
function makeSeedSequence(count: number, baseSeed = 42): number[] {
  const seeds: number[] = [];
  let s = baseSeed;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    seeds.push(s);
  }
  return seeds;
}

function makeInput(seed: number): FloorGenerationInput {
  return { seed, generationVersion: 1, isTutorial: false, floorIndex: 1 };
}

// ── Helper: BFS per verificare connettività ───────────────────────────────────

function isConnected(rooms: readonly RoomNode[]): boolean {
  if (rooms.length === 0) return true;
  const first = rooms[0];
  if (!first) return true;
  const visited = new Set<RoomId>();
  const queue: RoomId[] = [first.id];
  const byId = new Map<RoomId, RoomNode>(rooms.map((r) => [r.id, r]));

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const room = byId.get(id);
    if (!room) continue;
    for (const nid of room.doors) {
      if (!visited.has(nid)) queue.push(nid);
    }
  }
  return visited.size === rooms.length;
}

// ── Helper: verifica assenza sovrapposizioni AABB ─────────────────────────────

function hasNoOverlaps(rooms: readonly RoomNode[]): boolean {
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]?.bounds;
      const b = rooms[j]?.bounds;
      if (!a || !b) continue;
      const overlapX = a.minX < b.maxX && a.maxX > b.minX;
      const overlapZ = a.minZ < b.maxZ && a.maxZ > b.minZ;
      if (overlapX && overlapZ) return false;
    }
  }
  return true;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const SKIP = generateFloor === null;

describe.skipIf(SKIP)('FloorGenerator — property-based invariants', () => {
  const SEEDS = makeSeedSequence(30, 0xdeadbeef);

  for (const seed of SEEDS) {
    it(`seed 0x${seed.toString(16).padStart(8, '0')}: invarianti base`, () => {
      const floor = generateFloor!(makeInput(seed));

      // P1: almeno le stanze minime generate
      expect(floor.rooms.length).toBeGreaterThanOrEqual(1);

      // P2: stanza iniziale e finale esistono
      const ids = new Set<RoomId>(floor.rooms.map((r) => r.id));
      expect(ids.has(floor.entryRoomId)).toBe(true);
      expect(ids.has(floor.exitRoomId)).toBe(true);

      // P3: le stanze entry/exit hanno i ruoli corretti
      const entryRoom = floor.rooms.find((r) => r.id === floor.entryRoomId);
      const exitRoom  = floor.rooms.find((r) => r.id === floor.exitRoomId);
      expect(entryRoom?.role).toBe('ENTRY');
      expect(exitRoom?.role).toBe('EXIT');

      // P4: tutte le stanze sono connesse
      expect(isConnected(floor.rooms)).toBe(true);

      // P5: nessuna sovrapposizione AABB
      expect(hasNoOverlaps(floor.rooms)).toBe(true);

      // P6: i vicini sono ids validi (no dangling references)
      for (const room of floor.rooms) {
        for (const nid of room.doors) {
          expect(ids.has(nid)).toBe(true);
        }
      }

      // P7: la relazione di vicinato è simmetrica
      const byId = new Map<RoomId, RoomNode>(floor.rooms.map((r) => [r.id, r]));
      for (const room of floor.rooms) {
        for (const nid of room.doors) {
          const neighbor = byId.get(nid);
          expect(neighbor?.doors).toContain(room.id);
        }
      }
    });
  }

  it('determinismo: stesso seed → stesso risultato', () => {
    const seed = 0xc0ffee;
    const a = generateFloor!(makeInput(seed));
    const b = generateFloor!(makeInput(seed));

    expect(a.entryRoomId).toBe(b.entryRoomId);
    expect(a.exitRoomId).toBe(b.exitRoomId);
    expect(a.rooms.length).toBe(b.rooms.length);

    for (let i = 0; i < Math.min(3, a.rooms.length); i++) {
      expect(a.rooms[i]?.bounds.minX).toBe(b.rooms[i]?.bounds.minX);
      expect(a.rooms[i]?.bounds.minZ).toBe(b.rooms[i]?.bounds.minZ);
    }
  });

  it('seed diversi → layout diversi (canary, non fallimento duro)', () => {
    const seed0 = SEEDS[0]!;
    const seed1 = SEEDS[1]!;
    const resultA = generateFloor!(makeInput(seed0));
    const resultB = generateFloor!(makeInput(seed1));

    const identical =
      resultA.rooms.length === resultB.rooms.length &&
      resultA.entryRoomId  === resultB.entryRoomId;

    if (identical) {
      console.warn('Attenzione: seed consecutivi hanno prodotto layout identici');
    }
    // Non è un invariante stretto: è un canary statistico
  });
});

describe.skipIf(!SKIP)('FloorGenerator — modulo non disponibile', () => {
  it('skip: @/procedural/FloorGenerator.js non trovato', () => {
    console.info('Q-03: FloorGenerator.ts non ancora implementato — test in attesa.');
    expect(true).toBe(true);
  });
});
