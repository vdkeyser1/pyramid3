import { describe, expect, it } from 'vitest';
import { LightReflectionPuzzle } from '@/gameplay/LightReflectionPuzzle.js';

describe('LightReflectionPuzzle — Enigmi solari a specchi di bronzo (Fase 4)', () => {
  it('ruota gli specchi di 45 gradi e risolve il puzzle quando il raggio converge sul bersaglio', () => {
    const puzzle = new LightReflectionPuzzle('astronomical_shrine', 'Cripta dei Faraoni', 0, 90);

    expect(puzzle.state.isSolved).toBe(false);

    puzzle.rotateMirror('mirror_central'); // 45 deg
    expect(puzzle.state.isSolved).toBe(false);

    puzzle.rotateMirror('mirror_central'); // 90 deg
    expect(puzzle.state.isSolved).toBe(true);
    expect(puzzle.state.targets[0]?.isIlluminated).toBe(true);
  });
});
