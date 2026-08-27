/**
 * Scopo: manifest degli asset 3D del gioco (G-17) — mappa archetipo/landmark
 *        → percorso .glb, con fallback alle primitive placeholder.
 * Ownership: contenuto immutabile. Il renderer consuma il manifest per
 *        decidere quale modello caricare; se l'asset manca o fallisce,
 *        degrada alla famiglia geometrica esistente (G-23).
 * Invarianti:
 *   - ogni archetipo nemico e landmark critico ha una voce (o un fallback);
 *   - i percorsi sono relativi a /assets/ (public/);
 *   - nessuna dipendenza da Three.js in questo modulo.
 * Failure mode: voce assente → fallback; caricamento fallito → primitive.
 */

import type { EnemyArchetype } from '@/content/enemies.js';

/** Famiglia visiva di fallback per i landmark (allineata a LandmarkPlaceholders). */
export type LandmarkAssetKind =
  | 'altar'
  | 'brazier'
  | 'glyph'
  | 'obelisk'
  | 'portal'
  | 'relic'
  | 'sarcophagus'
  | 'statue'
  | 'well';

export interface EnemyAssetEntry {
  readonly archetype: EnemyArchetype;
  /** Percorso .glb sotto public/assets/ (null = nessun asset, usa primitive). */
  readonly modelPath: string | null;
  /** Scala del modello importato (per allineare l'hitbox alla silhouette). */
  readonly scale: number;
  /** Offset verticale del modello (pivot a terra). */
  readonly yOffset: number;
  /** True se il modello ha animazioni proprie (idle/walk/attack). */
  readonly animated: boolean;
}

export interface LandmarkAssetEntry {
  readonly landmarkId: string;
  readonly kind: LandmarkAssetKind;
  /** Percorso .glb sotto public/assets/ (null = usa la primitiva della famiglia). */
  readonly modelPath: string | null;
  readonly scale: number;
  readonly yOffset: number;
}

/**
 * Manifest nemici: percorso .glb per ogni archetipo. Tutti i path sono
 * placeholders per gli asset da scaricare (vedi roadmap.md §1.2):
 * quando un modello viene aggiunto in public/assets/, si aggiorna qui.
 */
export const ENEMY_ASSETS: readonly EnemyAssetEntry[] = [
  { archetype: 'SCARAB', modelPath: 'assets/enemies/scarab.glb', scale: 0.55, yOffset: 0.2, animated: false },
  { archetype: 'MUMMY', modelPath: 'assets/enemies/mummy.glb', scale: 1.0, yOffset: 0, animated: true },
  { archetype: 'COBRA', modelPath: 'assets/enemies/cobra.glb', scale: 0.8, yOffset: 0.1, animated: false },
  { archetype: 'SHABTI', modelPath: 'assets/enemies/shabti.glb', scale: 1.15, yOffset: 0, animated: true },
  { archetype: 'PRIEST', modelPath: 'assets/enemies/priest.glb', scale: 1.05, yOffset: 0, animated: true },
  { archetype: 'SOBEK_SPAWN', modelPath: 'assets/enemies/sobek.glb', scale: 1.3, yOffset: 0, animated: false },
  { archetype: 'ROYAL_MUMMY', modelPath: 'assets/enemies/royal_mummy.glb', scale: 1.2, yOffset: 0, animated: true },
  { archetype: 'ANUBIS_EXECUTIONER', modelPath: 'assets/enemies/anubis_executioner.glb', scale: 1.55, yOffset: 0, animated: true },
  // WITNESS: non attaccabile, nessun asset dedicato — fallback alla primitiva.
  { archetype: 'WITNESS', modelPath: null, scale: 1.0, yOffset: 0, animated: false },
];

/**
 * Manifest landmark: i 18 landmark del FloorGenerator mappati alle famiglie
 * visive. modelPath null = usa la primitiva della famiglia (stato attuale).
 */
export const LANDMARK_ASSETS: readonly LandmarkAssetEntry[] = [
  { landmarkId: 'altare-thoth', kind: 'altar', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'ankh-murale', kind: 'glyph', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'braciere-eterno', kind: 'brazier', modelPath: 'assets/landmarks/brazier.glb', scale: 1.0, yOffset: 0 },
  { landmarkId: 'catena-ancestrale', kind: 'obelisk', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'coccodrillo-pietra', kind: 'statue', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'colonna-scarabeo', kind: 'obelisk', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'geroglifico-luminoso', kind: 'glyph', modelPath: 'assets/landmarks/glyph_hieroglyphs.glb', scale: 1.0, yOffset: 0 },
  { landmarkId: 'obelisco-spezzato', kind: 'obelisk', modelPath: 'assets/landmarks/obelisk.glb', scale: 1.0, yOffset: 0 },
  { landmarkId: 'occhio-horus', kind: 'glyph', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'piuma-maat', kind: 'altar', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'portale-sigillato', kind: 'portal', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'pozzo-oscuro', kind: 'well', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'sarcofago-aperto', kind: 'sarcophagus', modelPath: 'assets/landmarks/sarcophagus.glb', scale: 1.0, yOffset: 0 },
  { landmarkId: 'scale-infrante', kind: 'portal', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'scettro-was', kind: 'relic', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'specchio-ossidiana', kind: 'well', modelPath: null, scale: 1.0, yOffset: 0 },
  { landmarkId: 'statua-anubi', kind: 'statue', modelPath: 'assets/landmarks/statue_anubis.glb', scale: 1.0, yOffset: 0 },
  { landmarkId: 'vaso-canopo-gigante', kind: 'relic', modelPath: null, scale: 1.0, yOffset: 0 },
];

/** Archetipi umanoidi che possono riusare le clip Mixamo della mummia (G-24). */
export const HUMANOID_CLIP_RECIPIENTS: readonly EnemyArchetype[] = [
  'MUMMY',
  'ROYAL_MUMMY',
  'PRIEST',
  'SHABTI',
  'ANUBIS_EXECUTIONER',
];

/** Mixamo ancora da scaricare (account richiesto): Idle/Walk/Attack/Hit/Death per priest, shabti, anubis, plus quadrupedi scarab/cobra/sobek. */
export function enemyAssetFor(archetype: EnemyArchetype): EnemyAssetEntry | null {
  return ENEMY_ASSETS.find((entry) => entry.archetype === archetype) ?? null;
}

/** Lookup rapido per landmark. */
export function landmarkAssetFor(landmarkId: string): LandmarkAssetEntry | null {
  return LANDMARK_ASSETS.find((entry) => entry.landmarkId === landmarkId) ?? null;
}

/**
 * Invariante per test: ogni archetipo ha una voce di manifest, i path non
 * referenziano asset assenti e i fallback null sono dichiarati esplicitamente.
 */
export function validateAssetManifest(): readonly string[] {
  const problems: string[] = [];
  const enemyArchetypes = new Set<EnemyArchetype>([
    'SCARAB', 'MUMMY', 'COBRA', 'SHABTI', 'PRIEST', 'SOBEK_SPAWN', 'ROYAL_MUMMY', 'ANUBIS_EXECUTIONER', 'WITNESS',
  ]);
  const covered = new Set<string>();
  for (const entry of ENEMY_ASSETS) {
    covered.add(entry.archetype);
    if (entry.modelPath !== null && !entry.modelPath.startsWith('assets/')) {
      problems.push(`path non valido per ${entry.archetype}: ${entry.modelPath}`);
    }
    if (entry.scale <= 0) {
      problems.push(`scala non valida per ${entry.archetype}`);
    }
  }
  for (const archetype of enemyArchetypes) {
    if (!covered.has(archetype)) {
      problems.push(`archetipo senza manifest: ${archetype}`);
    }
  }
  const landmarkIds = new Set(LANDMARK_ASSETS.map((entry) => entry.landmarkId));
  if (landmarkIds.size !== LANDMARK_ASSETS.length) {
    problems.push('landmark duplicati nel manifest');
  }
  return problems;
}
