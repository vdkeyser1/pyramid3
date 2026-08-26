import { describe, expect, it } from 'vitest';
import { decorateRoom } from '@/content/ProceduralDecorator.js';
import { getRoomArchetypeById } from '@/content/RoomArchetypes.js';

describe('ProceduralDecorator (GAME-ART-010)', () => {
  const tiles: readonly [number, number][] = [
    [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1],
    [0, 2], [1, 2], [2, 2], [3, 1], [4, 0], [5, 2],
  ];

  it('è deterministico: stesso seed ⇒ stessa disposizione', () => {
    const archetype = getRoomArchetypeById('FUNERARY_CHAMBER');
    expect(archetype).toBeDefined();
    const a = decorateRoom(archetype!, tiles, 42);
    const b = decorateRoom(archetype!, tiles, 42);
    expect(a.props).toEqual(b.props);
    expect(a.torches).toEqual(b.torches);
    expect(a.clues).toEqual(archetype!.environmentalClues);
  });

  it('seed diversi producono disposizioni diverse (con abbastanza tile)', () => {
    const archetype = getRoomArchetypeById('PHARAOH_HALL');
    expect(archetype).toBeDefined();
    const denseTiles: [number, number][] = [];
    for (let x = 0; x < 12; x++) {
      for (let z = 0; z < 12; z++) denseTiles.push([x, z]);
    }
    const a = decorateRoom(archetype!, denseTiles, 1);
    const b = decorateRoom(archetype!, denseTiles, 99);
    const same = JSON.stringify(a.props) === JSON.stringify(b.props)
      && JSON.stringify(a.torches) === JSON.stringify(b.torches);
    expect(same).toBe(false);
  });
});
