import { describe, expect, it } from 'vitest';
import {
  ROOM_ARCHETYPES,
  resolveRoomArchetype,
  getRoomArchetypeById,
} from '@/content/RoomArchetypes.js';
import type { RoomRole } from '@/procedural/FloorValidator.js';

describe('RoomArchetypes — Sistema dei 32 Archetipi della Piramide (G-22)', () => {
  it('contiene esattamente 32 archetipi di stanza definiti', () => {
    expect(ROOM_ARCHETYPES.length).toBe(32);
  });

  it('tutti gli archetipi hanno ID e nomi univoci', () => {
    const ids = new Set<string>();
    const names = new Set<string>();

    for (const archetype of ROOM_ARCHETYPES) {
      expect(ids.has(archetype.id)).toBe(false);
      expect(names.has(archetype.name)).toBe(false);
      ids.add(archetype.id);
      names.add(archetype.name);

      expect(archetype.description.length).toBeGreaterThan(15);
      expect(archetype.environmentalClues.length).toBeGreaterThanOrEqual(3);
      expect(archetype.lightScale).toBeGreaterThan(0);
    }
  });

  it('resolveRoomArchetype è deterministico e restituisce sempre un archetipo valido', () => {
    const roles: readonly RoomRole[] = [
      'ENTRY', 'EXIT', 'SAFE', 'COMBAT', 'TOOL', 'MAP', 'TREASURE', 'FORGE', 'OPTIONAL', 'JUNCTION', 'STAIR',
    ];

    for (const role of roles) {
      const a1 = resolveRoomArchetype(3, 7, role, 'SACRED');
      const a2 = resolveRoomArchetype(3, 7, role, 'SACRED');
      expect(a1.id).toBe(a2.id);
      expect(a1.name).toBeDefined();
    }
  });

  it('getRoomArchetypeById recupera correttamente per ID', () => {
    const pharaoh = getRoomArchetypeById('PHARAOH_HALL');
    expect(pharaoh).toBeDefined();
    expect(pharaoh?.name).toBe('Sala del Faraone');
    expect(pharaoh?.gpuCost).toBe('HIGH');

    expect(getRoomArchetypeById('ANUBIS_JUDGMENT_HALL')?.rarity).toBe('BOSS');
    expect(getRoomArchetypeById('BOSS_ANTECHAMBER')?.rarity).toBe('UNIQUE');
  });
});
