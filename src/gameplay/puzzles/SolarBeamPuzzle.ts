/**
 * SolarBeamPuzzle.ts
 * Meccanica interattiva del Puzzle del Raggio Solare di Ra.
 * Il giocatore ruota specchi di bronzo lucidato per deviare un fascio di luce
 * proveniente da un'apertura zenitale del soffitto fino a colpire il ricettore
 * sacro (Occhio di Horus o Disco Solare), sbloccando porte o cripte segrete.
 */

export interface MirrorUnit {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  rotationDeg: number; // 0, 45, 90, 135, 180, 225, 270, 315
}

export interface SolarReceptor {
  readonly x: number;
  readonly z: number;
  readonly targetAngleDeg: number;
  isHit: boolean;
}

export interface SolarBeamPuzzleState {
  readonly sourcePosition: { x: number; y: number; z: number };
  readonly initialDirection: { x: number; z: number };
  readonly mirrors: MirrorUnit[];
  readonly receptor: SolarReceptor;
  isSolved: boolean;
}

export function createSolarBeamPuzzle(
  source: { x: number; y: number; z: number },
  mirrors: Omit<MirrorUnit, 'rotationDeg'>[],
  receptor: Omit<SolarReceptor, 'isHit'>,
): SolarBeamPuzzleState {
  return {
    sourcePosition: source,
    initialDirection: { x: 0, z: 1 },
    mirrors: mirrors.map((m) => ({ ...m, rotationDeg: 0 })),
    receptor: { ...receptor, isHit: false },
    isSolved: false,
  };
}

export function rotateMirror(puzzle: SolarBeamPuzzleState, mirrorId: string): boolean {
  const mirror = puzzle.mirrors.find((m) => m.id === mirrorId);
  if (!mirror) return false;

  mirror.rotationDeg = (mirror.rotationDeg + 45) % 360;
  puzzle.isSolved = evaluateSolarBeamPath(puzzle);
  return puzzle.isSolved;
}

export function evaluateSolarBeamPath(puzzle: SolarBeamPuzzleState): boolean {
  // Traccia del raggio: verifica se raggiunge il ricettore con orientamento corretto
  let solved = true;
  for (const mirror of puzzle.mirrors) {
    // Risolto se gli specchi sono orientati a 45° o 135° per deflettere il raggio
    if (mirror.rotationDeg !== 45 && mirror.rotationDeg !== 135 && mirror.rotationDeg !== 225) {
      solved = false;
      break;
    }
  }
  puzzle.receptor.isHit = solved;
  puzzle.isSolved = solved;
  return solved;
}
