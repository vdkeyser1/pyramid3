import { describe, expect, it } from 'vitest';
import {
  evaluateFloorEvent,
  FLOOR_EVENTS,
} from '@/gameplay/FloorEventManager.js';

describe('FloorEventManager — Eventi dinamici di piano (P17)', () => {
  it('contiene tutte le definizioni degli eventi di piano con parametri validi', () => {
    expect(FLOOR_EVENTS.SAND_STORM_SURGE.sandStormIntensity).toBeGreaterThan(0.5);
    expect(FLOOR_EVENTS.ECLIPSE_OF_RA.torchModifier).toBeLessThan(1.0);
    expect(FLOOR_EVENTS.SOLAR_BLESSING_BURST.torchModifier).toBeGreaterThan(1.0);
    expect(FLOOR_EVENTS.MUMMY_AWAKENING.enemySpeedModifier).toBeGreaterThan(1.0);
  });

  it('evaluateFloorEvent è deterministico e rispetta le regole tematiche', () => {
    const ev1 = evaluateFloorEvent(12345, 2, 4, 'COLLAPSED');
    const ev2 = evaluateFloorEvent(12345, 2, 4, 'COLLAPSED');

    if (ev1) {
      expect(ev2).not.toBeNull();
      expect(ev1.type).toBe(ev2?.type);
      expect(ev1.type).toBe('SAND_STORM_SURGE');
    }
  });

  it('stanze a tema INFESTED generano MUMMY_AWAKENING quando l evento scatta', () => {
    // Cerchiamo un seed che attiva l'evento
    let found = false;
    for (let r = 0; r < 20; r++) {
      const ev = evaluateFloorEvent(42, 1, r, 'INFESTED');
      if (ev) {
        expect(ev.type).toBe('MUMMY_AWAKENING');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
