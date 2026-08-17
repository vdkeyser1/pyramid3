import { describe, expect, it } from 'vitest';
import { generateFloor } from '@/procedural/FloorGenerator.js';

const GENERATION_VERSION = 1;
const FLOOR_SPAN_M = 20;

function roomColumn(floor: ReturnType<typeof generateFloor>, roomId: number): number {
  const room = floor.rooms.find((candidate) => Number(candidate.id) === roomId);
  if (!room) {
    throw new Error(`Room ${roomId} not found`);
  }
  return Math.round(room.bounds.minX / FLOOR_SPAN_M);
}

describe('FloorGenerator', () => {
  it('preferEarlyMap sposta la stanza mappa nella prima metà del piano', () => {
    const seeds = [7, 11, 29, 71, 1234, 65535, 0x1a2b3c4d];

    for (const seed of seeds) {
      const floor = generateFloor({
        seed,
        generationVersion: GENERATION_VERSION,
        isTutorial: false,
        floorIndex: 1,
        preferEarlyMap: true,
      });

      const maxCol = Math.max(...floor.rooms.map((room) => Math.round(room.bounds.minX / FLOOR_SPAN_M)));
      const earlyThresholdCol = Math.floor(maxCol / 2);

      expect(roomColumn(floor, Number(floor.mapRoomId))).toBeLessThanOrEqual(earlyThresholdCol);
    }
  });
});
