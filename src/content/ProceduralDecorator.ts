/**
 * GAME-ART-010 — ProceduralDecorator.
 *
 * Scopo: disposizione deterministica dei props per archetipo (Poisson-like
 *        su tile occupate). Modulo PURO: nessun Three.js.
 * Ownership: content. Consumato da RoomDecor / test di seed.
 * Invarianti:
 *   - stesso seed + stesse tile ⇒ stessa DecoResult;
 *   - densità da PropDensity dell'archetipo;
 *   - clues copiati da environmentalClues (GAME-ART-012).
 */

import type { RoomArchetype } from '@/content/RoomArchetypes.js';
import type { PropDensity } from '@/content/RoomThemes.js';
import { hash32 } from '@/procedural/Hash32.js';

export interface DecoProp {
  readonly meshKey: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly castShadow: boolean;
}

export interface DecoResult {
  readonly props: readonly DecoProp[];
  readonly torches: readonly [number, number, number][];
  readonly clues: readonly string[];
}

export const DECOR_TILE_SIZE_M = 3;

/** Griglia di tile internamente alla stanza, con margine dalle pareti. */
export function tilesFromBounds(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  marginM = 1.6,
): [number, number][] {
  const tiles: [number, number][] = [];
  const innerMinX = minX + marginM;
  const innerMaxX = maxX - marginM;
  const innerMinZ = minZ + marginM;
  const innerMaxZ = maxZ - marginM;
  if (innerMaxX <= innerMinX || innerMaxZ <= innerMinZ) return tiles;

  const minTx = Math.floor(innerMinX / DECOR_TILE_SIZE_M);
  const maxTx = Math.floor(innerMaxX / DECOR_TILE_SIZE_M);
  const minTz = Math.floor(innerMinZ / DECOR_TILE_SIZE_M);
  const maxTz = Math.floor(innerMaxZ / DECOR_TILE_SIZE_M);
  for (let tx = minTx; tx <= maxTx; tx++) {
    for (let tz = minTz; tz <= maxTz; tz++) {
      const wx = tx * DECOR_TILE_SIZE_M;
      const wz = tz * DECOR_TILE_SIZE_M;
      if (wx < innerMinX || wx > innerMaxX || wz < innerMinZ || wz > innerMaxZ) continue;
      tiles.push([tx, tz]);
    }
  }
  return tiles;
}

const PROP_SETS: Record<string, readonly string[]> = {
  FUNERARY: ['sarcophagus', 'canopic_jar', 'bone_pile', 'torch'],
  ROYAL: ['column_egyptian', 'throne', 'banner', 'torch'],
  SACRED: ['altar', 'statue_anubis', 'incense_burner', 'torch'],
  INFESTED: ['scarab_nest', 'web', 'bone_pile', 'egg_cluster'],
  TREASURE_VAULT: ['urn_gold', 'coin_pile', 'chest', 'torch'],
  COLLAPSED: ['rubble', 'broken_column', 'dust_cloud'],
  PLAIN: ['crate', 'amphora', 'torch'],
  SAND_FILLED: ['amphora', 'rubble', 'torch'],
  PLUNDERED: ['chest', 'bone_pile', 'torch'],
  ASTRONOMICAL: ['altar', 'incense_burner', 'torch'],
  GREAT_GALLERY: ['column_egyptian', 'banner', 'torch'],
};

const DENSITY: Record<PropDensity, number> = {
  NONE: 0,
  SPARSE: 0.03,
  NORMAL: 0.12,
  DENSE: 0.22,
};

/** xorshift32 locale: non condivide stato con altri canali di generazione. */
function makeRng(seed: number): { next(): number; range(min: number, max: number): number } {
  let state = (seed >>> 0) === 0 ? 0x9e3779b9 : seed >>> 0;
  const next = (): number => {
    let x = state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    state = x;
    return x / 0x100000000;
  };
  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
  };
}

export function decorateRoom(
  archetype: RoomArchetype,
  floorTiles: readonly [number, number][],
  seed: number,
): DecoResult {
  const rng = makeRng(hash32(seed, 0xe6197));
  const density = DENSITY[archetype.props];
  const fallbackProps: readonly string[] = ['crate', 'amphora', 'torch'];
  const propSet = PROP_SETS[archetype.theme] ?? fallbackProps;
  const props: DecoProp[] = [];
  const torches: [number, number, number][] = [];
  const occupied = new Set<string>();

  for (const [tx, tz] of floorTiles) {
    if (rng.next() >= density) continue;
    const key = `${tx},${tz}`;
    if (occupied.has(key)) continue;
    occupied.add(key);

    const meshKey = propSet[Math.floor(rng.next() * propSet.length)] ?? 'amphora';
    if (meshKey === 'torch') {
      torches.push([tx * DECOR_TILE_SIZE_M, 2.5, tz * DECOR_TILE_SIZE_M]);
    } else {
      props.push({
        meshKey,
        position: [
          tx * DECOR_TILE_SIZE_M + rng.range(-0.5, 0.5),
          0,
          tz * DECOR_TILE_SIZE_M + rng.range(-0.5, 0.5),
        ],
        rotation: [0, rng.range(0, Math.PI * 2), 0],
        scale: rng.range(0.85, 1.15),
        castShadow: true,
      });
    }
  }

  return { props, torches, clues: archetype.environmentalClues };
}
