import { describe, expect, it } from 'vitest';
import { generateFloor, pyramidGridFor } from '@/procedural/FloorGenerator.js';
import { MAX_FLOORS } from '@/content/floorProgression.js';

const GENERATION_VERSION = 1;

/**
 * La piramide si percorre dall'apice verso la base: ogni piano deve essere
 * più ampio del precedente. È l'unica promessa spaziale della struttura, e
 * senza queste asserzioni tornerebbe a essere solo un'intenzione — prima di
 * questo lavoro la griglia era fissa (8×6, 14 stanze) su tutti i livelli.
 */
describe('Geometria piramidale', () => {
  const floors = Array.from({ length: MAX_FLOORS }, (_, i) => i + 1);

  it('la griglia non si restringe mai scendendo', () => {
    for (let f = 2; f <= MAX_FLOORS; f++) {
      const above = pyramidGridFor(f - 1);
      const here = pyramidGridFor(f);
      expect(here.cols).toBeGreaterThanOrEqual(above.cols);
      expect(here.rows).toBeGreaterThanOrEqual(above.rows);
      expect(here.minRooms).toBeGreaterThanOrEqual(above.minRooms);
    }
  });

  it('la base è nettamente più ampia dell\'apice', () => {
    const apex = pyramidGridFor(1);
    const base = pyramidGridFor(MAX_FLOORS);
    expect(base.cols).toBeGreaterThan(apex.cols);
    expect(base.rows).toBeGreaterThan(apex.rows);
    // Almeno il doppio delle stanze: la differenza deve essere percepibile,
    // non un incremento marginale.
    expect(base.minRooms).toBeGreaterThanOrEqual(apex.minRooms * 2);
  });

  it('la griglia ha sempre abbastanza celle per le stanze richieste', () => {
    for (const f of floors) {
      const g = pyramidGridFor(f);
      // Senza questo margine la generazione non potrebbe mai riuscire e
      // ricadrebbe sempre sul piano di fallback.
      expect(g.cols * g.rows).toBeGreaterThan(g.minRooms);
    }
  });

  it('floorIndex fuori range viene limitato agli estremi', () => {
    expect(pyramidGridFor(0)).toEqual(pyramidGridFor(1));
    expect(pyramidGridFor(-5)).toEqual(pyramidGridFor(1));
    expect(pyramidGridFor(MAX_FLOORS + 7)).toEqual(pyramidGridFor(MAX_FLOORS));
  });

  it('indici frazionari si comportano come il piano intero', () => {
    expect(pyramidGridFor(3.9)).toEqual(pyramidGridFor(3));
  });

  it('i piani generati crescono davvero in numero di stanze', () => {
    // Verifica end-to-end: non basta che la griglia cresca, deve crescere
    // anche il piano prodotto realmente dal generatore.
    const roomsAtApex = generateFloor({
      seed: 12345,
      generationVersion: GENERATION_VERSION,
      isTutorial: false,
      floorIndex: 1,
      preferEarlyMap: false,
    }).rooms.length;

    const roomsAtBase = generateFloor({
      seed: 12345,
      generationVersion: GENERATION_VERSION,
      isTutorial: false,
      floorIndex: MAX_FLOORS,
      preferEarlyMap: false,
    }).rooms.length;

    expect(roomsAtBase).toBeGreaterThan(roomsAtApex);
  });

  it('ogni piano resta generabile e valido', () => {
    for (const f of floors) {
      const floor = generateFloor({
        seed: 0xC0FFEE + f,
        generationVersion: GENERATION_VERSION,
        isTutorial: false,
        floorIndex: f,
        preferEarlyMap: false,
      });
      expect(floor.rooms.length).toBeGreaterThan(0);
      expect(floor.floorIndex).toBe(f);
    }
  });
});
