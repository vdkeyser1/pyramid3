import { describe, expect, it } from 'vitest';
import { SecretChamberSystem } from '@/gameplay/SecretChamberSystem.js';
import { getRoomNarrative } from '@/gameplay/RoomNarrativeDirector.js';

describe('SecretChamberSystem & RoomNarrativeDirector — Varchi segreti e narrazione', () => {
  it('genera camere segrete con indizi sensoriali e consente la scoperta', () => {
    const system = new SecretChamberSystem();
    const rooms = [
      { roomId: 1, center: { x: 0, z: 0 } },
      { roomId: 2, center: { x: 10, z: 0 } },
      { roomId: 3, center: { x: 20, z: 0 } },
    ];

    const generated = system.generateForFloor(42, 3, rooms);
    expect(generated.length).toBeGreaterThan(0);
    expect(generated[0]?.clueText.length).toBeGreaterThan(10);

    const found = system.findNearbySecret({ x: 10, z: 0 }, 3.0);
    expect(found).not.toBeNull();

    if (found) {
      const discovered = system.discoverSecret(found.id);
      expect(discovered?.isDiscovered).toBe(true);
      expect(discovered?.isOpen).toBe(true);
    }
  });

  it('getRoomNarrative genera descrizioni coerenti ed evocative per ogni tema', () => {
    const narrative = getRoomNarrative(123, 2, 4, 'ROYAL');
    expect(narrative.title).toContain('Camera del Faraone');
    expect(narrative.description.length).toBeGreaterThan(20);
    expect(narrative.atmosphericClue.length).toBeGreaterThan(10);
  });
});
