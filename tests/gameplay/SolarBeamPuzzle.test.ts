import { describe, it, expect } from 'vitest';
import { createSolarBeamPuzzle, rotateMirror } from '../../src/gameplay/puzzles/SolarBeamPuzzle';

describe('SolarBeamPuzzle', () => {
  it('inizializza il puzzle solare come non risolto', () => {
    const puzzle = createSolarBeamPuzzle(
      { x: 0, y: 4, z: 0 },
      [{ id: 'm1', x: 0, z: 5 }],
      { x: 5, z: 5, targetAngleDeg: 90 },
    );
    expect(puzzle.isSolved).toBe(false);
    expect(puzzle.mirrors[0]!.rotationDeg).toBe(0);
  });

  it('risolve il puzzle quando lo specchio viene orientato a 45°', () => {
    const puzzle = createSolarBeamPuzzle(
      { x: 0, y: 4, z: 0 },
      [{ id: 'm1', x: 0, z: 5 }],
      { x: 5, z: 5, targetAngleDeg: 90 },
    );
    const solved = rotateMirror(puzzle, 'm1');
    expect(puzzle.mirrors[0]!.rotationDeg).toBe(45);
    expect(solved).toBe(true);
    expect(puzzle.isSolved).toBe(true);
    expect(puzzle.receptor.isHit).toBe(true);
  });
});
