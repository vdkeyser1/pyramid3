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

export const MAX_FLOORS = 20;

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

/** Progressione completa su 20 piani: piano 1 (Pyramidion d'oro) → piano 20 (Trono della Duat). */
export const FLOOR_PROGRESSION: readonly FloorProgressionDef[] = [
  // FASCIA 1: L'APICE DORATO & CAMERE SUPERIORI (Piani 1-5)
  {
    floorIndex: 1, theme: 'Il Pyramidion di Ra', directorBudget: 12, safeRoomCount: 1, junctionRatio: 0.12, maxConcurrentEnemies: 2,
    palette: T(0x8a6a3b, 0xa88b58, 0xf5c342, 0.0),
  },
  {
    floorIndex: 2, theme: 'La Grande Galleria Superiore', directorBudget: 18, safeRoomCount: 1, junctionRatio: 0.16, maxConcurrentEnemies: 3,
    palette: T(0x7a5e35, 0x94784a, 0x2e8b8b, 0.06),
  },
  {
    floorIndex: 3, theme: 'Anticamera dei Nobili', directorBudget: 24, safeRoomCount: 2, junctionRatio: 0.20, maxConcurrentEnemies: 3,
    palette: T(0x6b5432, 0x8a7350, 0xd4a05a, 0.12),
  },
  {
    floorIndex: 4, theme: 'Santuario degli Occhi di Horus', directorBudget: 30, safeRoomCount: 2, junctionRatio: 0.24, maxConcurrentEnemies: 3,
    palette: T(0x5f5330, 0x7d7350, 0x3a7d5a, 0.18),
  },
  {
    floorIndex: 5, theme: 'Camera del Faraone Ascendente', directorBudget: 38, safeRoomCount: 2, junctionRatio: 0.28, maxConcurrentEnemies: 4,
    palette: T(0x55402a, 0x6b5a3c, 0xc77d3a, 0.24),
  },

  // FASCIA 2: CAMERE DI SCARICO & LABIRINTO DEI FALSI PASSAGGI (Piani 6-10)
  {
    floorIndex: 6, theme: 'Camere di Scarico Monolitiche', directorBudget: 44, safeRoomCount: 2, junctionRatio: 0.32, maxConcurrentEnemies: 4,
    palette: T(0x4a3824, 0x5e4c32, 0x8b7355, 0.30),
  },
  {
    floorIndex: 7, theme: 'Labirinto dei Dardi Avvelenati', directorBudget: 50, safeRoomCount: 2, junctionRatio: 0.36, maxConcurrentEnemies: 4,
    palette: T(0x3e3526, 0x4e4430, 0x9a5a38, 0.36),
  },
  {
    floorIndex: 8, theme: 'Cripta dei Vasi Canopi Sigillati', directorBudget: 56, safeRoomCount: 2, junctionRatio: 0.40, maxConcurrentEnemies: 4,
    palette: T(0x342c1e, 0x443a28, 0x6a334d, 0.42),
  },
  {
    floorIndex: 9, theme: 'Corridoio Inclinato a Chevrons', directorBudget: 62, safeRoomCount: 2, junctionRatio: 0.44, maxConcurrentEnemies: 4,
    palette: T(0x2a2418, 0x3a3020, 0x4a90a0, 0.48),
  },
  {
    floorIndex: 10, theme: 'Trono dei Cento Guardiani Shabti', directorBudget: 70, safeRoomCount: 2, junctionRatio: 0.48, maxConcurrentEnemies: 5,
    palette: T(0x221d14, 0x30281b, 0xd4a05a, 0.54),
  },

  // FASCIA 3: SALE IPOSTILE & ARCHIVI DELLA DUAT (Piani 11-15)
  {
    floorIndex: 11, theme: 'Grande Sala Ipostila di Tebe', directorBudget: 76, safeRoomCount: 2, junctionRatio: 0.50, maxConcurrentEnemies: 5,
    palette: T(0x1e1912, 0x2a2217, 0x2e8b8b, 0.60),
  },
  {
    floorIndex: 12, theme: 'Archivio Proibito del Libro dei Morti', directorBudget: 82, safeRoomCount: 2, junctionRatio: 0.52, maxConcurrentEnemies: 5,
    palette: T(0x1a150f, 0x241d13, 0x8b7355, 0.65),
  },
  {
    floorIndex: 13, theme: 'Forgia Rituale del Bronzo Sacro', directorBudget: 88, safeRoomCount: 2, junctionRatio: 0.54, maxConcurrentEnemies: 5,
    palette: T(0x16120c, 0x201810, 0xd48a33, 0.70),
  },
  {
    floorIndex: 14, theme: 'Santuario della Furia di Sekhmet', directorBudget: 94, safeRoomCount: 2, junctionRatio: 0.56, maxConcurrentEnemies: 5,
    palette: T(0x140e0a, 0x1c130d, 0xaa2211, 0.75),
  },
  {
    floorIndex: 15, theme: 'Sepolcro del Gran Sacerdote di Eliopoli', directorBudget: 100, safeRoomCount: 2, junctionRatio: 0.58, maxConcurrentEnemies: 5,
    palette: T(0x120c08, 0x18100a, 0x996633, 0.80),
  },

  // FASCIA 4: NECROPOLI SOMMERSA & CATACOMBE DELLA ROCCIA MADRE (Piani 16-19)
  {
    floorIndex: 16, theme: 'Cunicoli Sommersi dalle Sabbie', directorBudget: 106, safeRoomCount: 2, junctionRatio: 0.60, maxConcurrentEnemies: 6,
    palette: T(0x100a06, 0x160e08, 0xcc8833, 0.84),
  },
  {
    floorIndex: 17, theme: 'Gallerie del Nilo Sotterraneo', directorBudget: 112, safeRoomCount: 2, junctionRatio: 0.62, maxConcurrentEnemies: 6,
    palette: T(0x0e0906, 0x140c07, 0x226688, 0.88),
  },
  {
    floorIndex: 18, theme: 'Le Catacombe dei Dannati Senza Nome', directorBudget: 118, safeRoomCount: 2, junctionRatio: 0.64, maxConcurrentEnemies: 6,
    palette: T(0x0c0704, 0x100905, 0x772244, 0.91),
  },
  {
    floorIndex: 19, theme: 'L Anticamera dell Ombra Eterna', directorBudget: 124, safeRoomCount: 2, junctionRatio: 0.66, maxConcurrentEnemies: 6,
    palette: T(0x0a0604, 0x0e0804, 0xaa8844, 0.94),
  },

  // FASCIA 5: IL CUORE PRIMORDIALE (Piano 20)
  {
    floorIndex: 20, theme: 'La Cripta Primordiale del Faraone Eterno', directorBudget: 135, safeRoomCount: 3, junctionRatio: 0.70, maxConcurrentEnemies: 6,
    palette: T(0x080402, 0x0c0603, 0xffcc33, 0.97),
  },
];

/** Lookup con clamp: piano ≤0 → 1, piano >20 → 20. Mai undefined. */
export function floorProgressionFor(floorIndex: number): FloorProgressionDef {
  const clamped = Math.max(1, Math.min(MAX_FLOORS, floorIndex));
  return FLOOR_PROGRESSION[clamped - 1] ?? FLOOR_PROGRESSION[0]!;
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
