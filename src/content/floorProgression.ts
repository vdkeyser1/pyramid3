/**
 * Scopo: progressione dei piani della piramide (G-10, design: docs/DESIGN_LIVELLI_SUPERIORI.md).
 * Data-driven: tema, palette, budget Director, room mix per ogni piano 1-10.
 * Ownership: contenuto immutabile. Consumato da FloorGenerator, EnemySpawnDirector,
 *        ThreeRendererService e GameApplication.
 * Invarianti:
 *   - 10 piani (allineato a enemyTemplates maxFloor: 10);
 *   - difficoltà crescente per COMPOSIZIONE (budget/concorrenza), mai HP;
 *   - palette per fascia coerente con ART_BIBLE (Noir egizio);
 *   - floorProgressionFor() clamp a [1, MAX_FLOORS] — mai undefined.
 * Failure mode: piano fuori range → clampa al piano 1 o 10 (nessun crash).
 */

export const MAX_FLOORS = 10;

export interface FloorPalette {
  readonly wallHex: number;
  readonly floorHex: number;
  readonly accentHex: number;
  /** Intensità del buio ambientale (0..1) — più profondo, più scuro. */
  readonly darknessFactor: number;
}

export interface FloorProgressionDef {
  readonly floorIndex: number;
  readonly theme: string;
  readonly palette: FloorPalette;
  /** Budget spawn del Threat Director (punti consumabili). */
  readonly directorBudget: number;
  /** Numero di stanze SAFE (rifornimento) sul piano. */
  readonly safeRoomCount: number;
  /** Probabilità che una stanza secondaria sia JUNCTION (0..1). */
  readonly junctionRatio: number;
  /** Slot nemici simultanei (cap). */
  readonly maxConcurrentEnemies: number;
}

const T = (wallHex: number, floorHex: number, accentHex: number, darknessFactor: number): FloorPalette => ({
  wallHex, floorHex, accentHex, darknessFactor,
});

/** Progressione completa: piano 1 (VS) → piano 10 (cuore della piramide). */
export const FLOOR_PROGRESSION: readonly FloorProgressionDef[] = [
  {
    floorIndex: 1, theme: 'Atrio dei sigilli', directorBudget: 12, safeRoomCount: 1, junctionRatio: 0.12, maxConcurrentEnemies: 2,
    palette: T(0x6b5432, 0x8a7350, 0xd4a05a, 0.0),
  },
  {
    floorIndex: 2, theme: 'Corridoi dei cobra', directorBudget: 22, safeRoomCount: 1, junctionRatio: 0.18, maxConcurrentEnemies: 3,
    palette: T(0x5f5330, 0x7d7350, 0x2e8b8b, 0.08),
  },
  {
    floorIndex: 3, theme: 'Gallerie degli Shabti', directorBudget: 32, safeRoomCount: 2, junctionRatio: 0.24, maxConcurrentEnemies: 3,
    palette: T(0x55402a, 0x6b5a3c, 0xc77d3a, 0.16),
  },
  {
    floorIndex: 4, theme: 'Cripta di Sobek', directorBudget: 42, safeRoomCount: 2, junctionRatio: 0.3, maxConcurrentEnemies: 4,
    palette: T(0x3e3526, 0x4e4430, 0x3a7d5a, 0.24),
  },
  {
    floorIndex: 5, theme: 'Ossario', directorBudget: 52, safeRoomCount: 2, junctionRatio: 0.34, maxConcurrentEnemies: 4,
    palette: T(0x2e2a22, 0x3a342a, 0x8b7355, 0.32),
  },
  {
    floorIndex: 6, theme: 'Ossario profondo', directorBudget: 58, safeRoomCount: 2, junctionRatio: 0.38, maxConcurrentEnemies: 4,
    palette: T(0x26221c, 0x322c24, 0x9a5a38, 0.4),
  },
  {
    floorIndex: 7, theme: 'Antro del Testimone', directorBudget: 64, safeRoomCount: 2, junctionRatio: 0.42, maxConcurrentEnemies: 4,
    palette: T(0x1c1a16, 0x282420, 0x6a334d, 0.48),
  },
  {
    floorIndex: 8, theme: 'Sotterranei del silenzio', directorBudget: 68, safeRoomCount: 2, junctionRatio: 0.46, maxConcurrentEnemies: 4,
    palette: T(0x161412, 0x201c18, 0x4a90a0, 0.56),
  },
  {
    floorIndex: 9, theme: 'Anticamera del Ka', directorBudget: 72, safeRoomCount: 2, junctionRatio: 0.5, maxConcurrentEnemies: 4,
    palette: T(0x100e0c, 0x1a1612, 0xd4a05a, 0.64),
  },
  {
    floorIndex: 10, theme: 'Camera del Ka', directorBudget: 80, safeRoomCount: 2, junctionRatio: 0.55, maxConcurrentEnemies: 4,
    palette: T(0x0b0908, 0x14100c, 0xffe0a0, 0.72),
  },
];

/** Lookup con clamp: piano ≤0 → 1, piano >10 → 10. Mai undefined. */
export function floorProgressionFor(floorIndex: number): FloorProgressionDef {
  const clamped = Math.max(1, Math.min(MAX_FLOORS, floorIndex));
  return FLOOR_PROGRESSION[clamped - 1] ?? FLOOR_PROGRESSION[0] ?? {
    floorIndex: 1, theme: 'Atrio dei sigilli', directorBudget: 12, safeRoomCount: 1, junctionRatio: 0.12, maxConcurrentEnemies: 2,
    palette: T(0x6b5432, 0x8a7350, 0xd4a05a, 0.0),
  };
}

/** Seed derivato del piano N: determinismo per run riproducibile. */
export function floorSeed(baseSeed: number, floorIndex: number): number {
  // FNV-1a-ish mix: stabile, niente Math.random
  let h = (baseSeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ floorIndex, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
