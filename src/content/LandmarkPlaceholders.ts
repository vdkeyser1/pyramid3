/**
 * Scopo: mappare landmark/ruoli procedurali a placeholder visivi semanticamente
 *        stabili, così il vertical slice resta leggibile anche senza asset finali.
 * Ownership: contenuto immutabile consumato dal renderer.
 * Invarianti:
 *   - stesso landmarkId/role => stessa famiglia visiva;
 *   - i landmark critici (uscita, tesoro, mappa, braciere) hanno silhouette distinte;
 *   - nessuna dipendenza da Three.js in questo modulo.
 * Failure mode: landmark sconosciuti degradano a una famiglia `relic`.
 */

import type { RoomRole } from '@/procedural/FloorValidator.js';

export type LandmarkPlaceholderKind =
  | 'altar'
  | 'brazier'
  | 'glyph'
  | 'obelisk'
  | 'portal'
  | 'relic'
  | 'sarcophagus'
  | 'statue'
  | 'well';

export interface LandmarkPlaceholderDefinition {
  readonly kind: LandmarkPlaceholderKind;
  readonly baseColorHex: number;
  readonly accentColorHex: number;
  readonly emissiveColorHex: number;
}

const ROLE_DEFAULTS: Record<RoomRole, LandmarkPlaceholderDefinition> = {
  ENTRY: { kind: 'relic', baseColorHex: 0x756046, accentColorHex: 0x9a7a54, emissiveColorHex: 0x120a06 },
  EXIT: { kind: 'portal', baseColorHex: 0x5a3f1b, accentColorHex: 0xd4a05a, emissiveColorHex: 0x2a1204 },
  SAFE: { kind: 'altar', baseColorHex: 0x645542, accentColorHex: 0xac9371, emissiveColorHex: 0x120d08 },
  MAP: { kind: 'glyph', baseColorHex: 0x355f63, accentColorHex: 0x69a5a3, emissiveColorHex: 0x0f2428 },
  TREASURE: { kind: 'sarcophagus', baseColorHex: 0x6f5831, accentColorHex: 0xc8a24a, emissiveColorHex: 0x1b1206 },
  COMBAT: { kind: 'statue', baseColorHex: 0x6f6454, accentColorHex: 0xb8aa8d, emissiveColorHex: 0x100b08 },
  TOOL: { kind: 'relic', baseColorHex: 0x6e593d, accentColorHex: 0xc29a61, emissiveColorHex: 0x160d07 },
  FORGE: { kind: 'altar', baseColorHex: 0x694e35, accentColorHex: 0xd68942, emissiveColorHex: 0x261103 },
  OPTIONAL: { kind: 'obelisk', baseColorHex: 0x5e513e, accentColorHex: 0xa68a5d, emissiveColorHex: 0x130d08 },
  JUNCTION: { kind: 'obelisk', baseColorHex: 0x5f5445, accentColorHex: 0xb09a70, emissiveColorHex: 0x130d09 },
  // G-10: la scala verso il piano successivo (pozzo discendente, luce turchese)
  STAIR: { kind: 'well', baseColorHex: 0x3a3a40, accentColorHex: 0x6ee0d1, emissiveColorHex: 0x144640 },
};

const LANDMARK_OVERRIDES: Record<string, LandmarkPlaceholderDefinition> = {
  'altare-thoth': { kind: 'altar', baseColorHex: 0x496468, accentColorHex: 0x90cbc8, emissiveColorHex: 0x173033 },
  'ankh-murale': { kind: 'glyph', baseColorHex: 0x3e5d5a, accentColorHex: 0x85c3bb, emissiveColorHex: 0x143331 },
  'braciere-eterno': { kind: 'brazier', baseColorHex: 0x5a3d24, accentColorHex: 0xffa340, emissiveColorHex: 0x6d2600 },
  'catena-ancestrale': { kind: 'obelisk', baseColorHex: 0x59504a, accentColorHex: 0xa89a80, emissiveColorHex: 0x110d08 },
  'coccodrillo-pietra': { kind: 'statue', baseColorHex: 0x566255, accentColorHex: 0x8aa37f, emissiveColorHex: 0x10110d },
  'colonna-scarabeo': { kind: 'obelisk', baseColorHex: 0x655138, accentColorHex: 0xb69248, emissiveColorHex: 0x180d05 },
  'geroglifico-luminoso': { kind: 'glyph', baseColorHex: 0x334e4a, accentColorHex: 0x6ee0d1, emissiveColorHex: 0x144640 },
  'obelisco-spezzato': { kind: 'obelisk', baseColorHex: 0x66543c, accentColorHex: 0xb38a54, emissiveColorHex: 0x1a0d06 },
  'occhio-horus': { kind: 'glyph', baseColorHex: 0x365254, accentColorHex: 0x69b7bf, emissiveColorHex: 0x14363a },
  'piuma-maat': { kind: 'altar', baseColorHex: 0x6e604f, accentColorHex: 0xd4b67a, emissiveColorHex: 0x19120a },
  'portale-sigillato': { kind: 'portal', baseColorHex: 0x4e4130, accentColorHex: 0x95c2c0, emissiveColorHex: 0x163432 },
  'pozzo-oscuro': { kind: 'well', baseColorHex: 0x3a3a40, accentColorHex: 0x62717c, emissiveColorHex: 0x08090d },
  'sarcofago-aperto': { kind: 'sarcophagus', baseColorHex: 0x6d5333, accentColorHex: 0xbe9c64, emissiveColorHex: 0x1a1007 },
  'scale-infrante': { kind: 'portal', baseColorHex: 0x57514b, accentColorHex: 0xa7987a, emissiveColorHex: 0x110e0a },
  'scettro-was': { kind: 'relic', baseColorHex: 0x735436, accentColorHex: 0xd8a84c, emissiveColorHex: 0x220e04 },
  'specchio-ossidiana': { kind: 'well', baseColorHex: 0x20262f, accentColorHex: 0x4e667f, emissiveColorHex: 0x0a1119 },
  'statua-anubi': { kind: 'statue', baseColorHex: 0x4f4c49, accentColorHex: 0xb89c68, emissiveColorHex: 0x120d08 },
  'vaso-canopo-gigante': { kind: 'relic', baseColorHex: 0x75583e, accentColorHex: 0xc9a05c, emissiveColorHex: 0x1a0f07 },
};

export function resolveLandmarkPlaceholder(
  landmarkId: string,
  role: RoomRole,
): LandmarkPlaceholderDefinition {
  return LANDMARK_OVERRIDES[landmarkId] ?? ROLE_DEFAULTS[role];
}
