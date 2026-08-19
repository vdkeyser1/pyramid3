/**
 * Scopo: decorazione procedurale delle stanze — vasi canopi, anfore,
 * candele, colonne, obelischi, statue di granito e pannelli con geroglifici
 * sulle pareti. Geometry + materiali condivisi, nessun asset esterno.
 * Ownership: rendering. Consumato da ThreeDungeonLayout dopo i landmark.
 * Invarianti:
 *   - deterministico: hash32(seed, roomId, slot) → posizione/rotazione/tipo;
 *   - nessuna decorazione nelle stanze critiche (entry/exit/tesoro/mappa);
 *   - oggetti puramente visivi (no collider).
 */

import * as THREE from 'three';
import type { FloorSceneLayout, FloorSceneRoom } from '@/world/FloorSceneLayout.js';
import { hash32 } from '@/procedural/Hash32.js';

const CRITICAL_ROLES: readonly string[] = ['ENTRY', 'EXIT', 'MAP', 'TREASURE', 'FORGE'];

export interface DecorateRoomsResult {
  readonly glyphMaterial: THREE.MeshStandardMaterial;
}

export interface DecorateRoomsOptions {
  readonly layout: FloorSceneLayout;
  readonly dungeonRoot: THREE.Group;
  readonly wallMaterial: THREE.Material;
  readonly sandColor?: number;
  readonly clayColor?: number;
  readonly candleColor?: number;
  readonly mood?: 'anticamera' | 'galleria' | 'cripta';
  /** Texture con geroglifici scolpiti per la lastra incisa dei pannelli muro. */
  readonly hieroglyphPanelTexture?: THREE.Texture | null;
}

const DECOR_TYPES = [
  'jar', 'amphora', 'candle', 'column', 'sandpile',
  'bones', 'skeleton', 'rug', 'altar', 'obelisk', 'floorGlyph', 'scarabTile',
] as const;
type DecorType = (typeof DECOR_TYPES)[number];

const SHARED_GEOMETRIES = new Map<DecorType, THREE.BufferGeometry>();

function geometryFor(type: DecorType): THREE.BufferGeometry {
  let geometry = SHARED_GEOMETRIES.get(type);
  if (geometry) return geometry;

  switch (type) {
    case 'jar':
      // Vaso canopo egiziano — cilindro rastremato, non sfera
      geometry = new THREE.CylinderGeometry(0.09, 0.17, 0.44, 8);
      break;
    case 'amphora':
      geometry = new THREE.ConeGeometry(0.16, 0.55, 8);
      break;
    case 'candle':
      geometry = new THREE.CylinderGeometry(0.045, 0.055, 0.32, 6);
      break;
    case 'column':
      geometry = new THREE.CylinderGeometry(0.16, 0.2, 2.1, 8);
      break;
    case 'bones':
      geometry = new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5);
      break;
    case 'skeleton':
      geometry = new THREE.CapsuleGeometry(0.14, 0.7, 4, 8);
      break;
    case 'rug':
      geometry = new THREE.CylinderGeometry(0.85, 0.95, 0.03, 10);
      break;
    case 'altar':
      geometry = new THREE.BoxGeometry(1.1, 0.28, 0.65);
      break;
    case 'obelisk':
      geometry = new THREE.CylinderGeometry(0.08, 0.13, 1.6, 4);
      break;
    case 'floorGlyph':
      geometry = new THREE.CylinderGeometry(0.55, 0.58, 0.022, 12);
      break;
    case 'scarabTile':
      // Tavoletta di granito con iscrizione — rettangolo piatto, non esagono
      geometry = new THREE.BoxGeometry(0.52, 0.012, 0.32);
      break;
    default:
      geometry = new THREE.ConeGeometry(0.35, 0.22, 7);
      break;
  }
  SHARED_GEOMETRIES.set(type, geometry);
  return geometry;
}

interface DecorPlacement {
  readonly type: DecorType;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly lying: boolean;
}

// ── Geometrie statue (lazy, condivise tra chiamate) ───────────────────────────
let _statueGeos: {
  readonly base: THREE.BoxGeometry;
  readonly body: THREE.BoxGeometry;
  readonly head: THREE.BoxGeometry;
  readonly nemes: THREE.BoxGeometry;
  readonly ear: THREE.BoxGeometry;
} | null = null;

function getStatueGeos() {
  if (_statueGeos) return _statueGeos;
  _statueGeos = {
    base:  new THREE.BoxGeometry(0.48, 0.18, 0.38),   // piedistallo
    body:  new THREE.BoxGeometry(0.24, 0.52, 0.20),   // corpo seduto
    head:  new THREE.BoxGeometry(0.22, 0.24, 0.20),   // testa
    nemes: new THREE.BoxGeometry(0.40, 0.20, 0.24),   // copricapo nemes
    ear:   new THREE.BoxGeometry(0.07, 0.16, 0.06),   // orecchie/orecchie (Anubi)
  };
  return _statueGeos;
}

// ── Geometrie pannelli geroglifici (lazy) ─────────────────────────────────────
let _panelGeos: {
  readonly frame: THREE.BoxGeometry;
  readonly inset: THREE.BoxGeometry;
  readonly line:  THREE.BoxGeometry;
} | null = null;

function getPanelGeos() {
  if (_panelGeos) return _panelGeos;
  _panelGeos = {
    frame: new THREE.BoxGeometry(0.82, 0.62, 0.040),   // cornice di pietra
    inset: new THREE.BoxGeometry(0.66, 0.46, 0.022),   // pannello inciso (rientrante)
    line:  new THREE.BoxGeometry(0.58, 0.006, 0.026),  // registro di geroglifici
  };
  return _panelGeos;
}

export function decorateRooms(options: DecorateRoomsOptions): DecorateRoomsResult {
  const {
    layout, dungeonRoot, wallMaterial,
    sandColor = 0x8a7350, clayColor = 0x9c6b3c,
    candleColor = 0xd4a05a, mood,
    hieroglyphPanelTexture = null,
  } = options;

  const moodIndex = mood === 'cripta' ? 1 : mood === 'anticamera' ? 2 : 0;

  // ── Materiali ────────────────────────────────────────────────────────────────
  const clayMaterial = new THREE.MeshStandardMaterial({
    color: clayColor, roughness: 0.82, metalness: 0.06,
  });
  const sandMaterial = new THREE.MeshStandardMaterial({
    color: sandColor, roughness: 1.0, metalness: 0.0,
  });
  const candleMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0dba0, roughness: 0.55, metalness: 0.0,
    emissive: 0xff9b30, emissiveIntensity: 0.9,
  });
  const boneMaterial = new THREE.MeshStandardMaterial({
    color: 0xcfc4a8, roughness: 0.9, metalness: 0.0,
  });
  const rugMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a2a18, roughness: 0.98, metalness: 0.0,
    emissive: 0x2a0d06, emissiveIntensity: 0.2,
  });
  const altarMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a2e22, roughness: 0.75, metalness: 0.15,
    emissive: 0x1a1006, emissiveIntensity: 0.3,
  });
  const obeliskMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3820, roughness: 0.6, metalness: 0.25,
    emissive: 0x8b5a00, emissiveIntensity: 0.5,
  });
  const glyphMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8900a, roughness: 0.3, metalness: 0.6,
    emissive: 0xaa6800, emissiveIntensity: 1.4,
  });
  const scarabMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a6050, roughness: 0.55, metalness: 0.25,
    emissive: 0x083828, emissiveIntensity: 0.5,
  });

  // ── Materiali statue e pannelli ───────────────────────────────────────────────
  const statueMat = new THREE.MeshStandardMaterial({
    color: 0x1C1810, roughness: 0.70, metalness: 0.20,
    emissive: 0x080604, emissiveIntensity: 0.12,
  });
  const panelFrameMat = new THREE.MeshStandardMaterial({
    color: 0x28200E, roughness: 0.92, metalness: 0.04,
  });
  const panelInsetMat = new THREE.MeshStandardMaterial({
    color: hieroglyphPanelTexture ? 0xffffff : 0x3A2C14,
    roughness: 0.88,
    metalness: 0.04,
    emissive: 0x1A0E04,
    emissiveIntensity: hieroglyphPanelTexture ? 0.0 : 0.16,
  });
  if (hieroglyphPanelTexture) {
    panelInsetMat.map = hieroglyphPanelTexture;
    panelInsetMat.emissiveMap = hieroglyphPanelTexture;
    panelInsetMat.emissiveIntensity = 0.12;
    panelInsetMat.emissive.setHex(0x8A5A10);
  }
  const panelLineMat = new THREE.MeshStandardMaterial({
    color: 0x8C6A28, roughness: 0.50, metalness: 0.10,
    emissive: 0x4A3010, emissiveIntensity: 0.42,
  });

  // ── Raccolta posizionamenti deterministici (decor sul pavimento) ──────────────
  const placementsByType = new Map<DecorType, DecorPlacement[]>();
  for (const room of layout.rooms) {
    if (CRITICAL_ROLES.includes(room.role)) continue;
    collectRoomPlacements(room, placementsByType, moodIndex);
  }

  // ── InstancedMesh per tipo ────────────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const candlePlacements: DecorPlacement[] = [];

  for (const type of DECOR_TYPES) {
    const placements = placementsByType.get(type);
    if (!placements || placements.length === 0) continue;

    const geometry = geometryFor(type);
    const material = materialFor(
      type, clayMaterial, sandMaterial, candleMaterial,
      wallMaterial, boneMaterial, rugMaterial,
      altarMaterial, obeliskMaterial, glyphMaterial, scarabMaterial,
    );
    const instanced = new THREE.InstancedMesh(geometry, material, placements.length);

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      if (!p) continue;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.lying ? Math.PI / 2 : 0, p.rotationY, 0);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
    instanced.castShadow = type !== 'rug' && type !== 'floorGlyph' && type !== 'scarabTile';
    instanced.receiveShadow = true;
    dungeonRoot.add(instanced);

    if (type === 'candle') {
      for (const p of placements) candlePlacements.push(p);
    }
  }

  // ── Luci puntiformi per le candele ────────────────────────────────────────────
  const MAX_CANDLE_LIGHTS = 6;
  for (let i = 0; i < Math.min(candlePlacements.length, MAX_CANDLE_LIGHTS); i++) {
    const p = candlePlacements[i];
    if (!p) continue;
    const light = new THREE.PointLight(0xff9b30, 5, 3.5, 2);
    light.position.set(p.x, p.y + 0.35, p.z);
    dungeonRoot.add(light);
  }

  // ── Statue agli angoli e pannelli geroglifici sulle pareti ────────────────────
  for (const room of layout.rooms) {
    if (CRITICAL_ROLES.includes(room.role)) continue;
    const w = room.bounds.maxX - room.bounds.minX;
    const d = room.bounds.maxZ - room.bounds.minZ;
    if (w >= 8 && d >= 8) {
      placeStatues(room, dungeonRoot, statueMat, Number(room.roomId) * 17 + 3);
      placeWallPanels(room, dungeonRoot, panelFrameMat, panelInsetMat, panelLineMat, Number(room.roomId) * 31 + 7);
    }
  }

  void candleColor;
  return { glyphMaterial };
}

function collectRoomPlacements(
  room: FloorSceneRoom,
  placementsByType: Map<DecorType, DecorPlacement[]>,
  moodIndex: number,
): void {
  const width = room.bounds.maxX - room.bounds.minX;
  const depth = room.bounds.maxZ - room.bounds.minZ;
  if (width < 5 || depth < 5) return;

  const pool: readonly DecorType[] = moodIndex === 1
    ? ['bones', 'bones', 'skeleton', 'rug', 'candle', 'jar', 'altar', 'obelisk']
    : moodIndex === 2
      ? ['jar', 'jar', 'amphora', 'column', 'candle', 'sandpile', 'floorGlyph', 'scarabTile']
      : ['jar', 'amphora', 'candle', 'column', 'sandpile', 'bones', 'skeleton',
         'rug', 'altar', 'obelisk', 'floorGlyph', 'scarabTile'];

  const slotCount = width >= 12 && depth >= 12 ? 6
    : width >= 10 && depth >= 10 ? 4
      : 2;

  for (let slot = 0; slot < slotCount; slot++) {
    const h = hash32(room.roomId, slot * 7 + 3);
    const type = pool[h % pool.length];
    if (!type) continue;

    const margin = type === 'column' || type === 'obelisk' ? 1.2 : 1.6;
    const tx = ((h >>> 8)  % 100) / 100;
    const tz = ((h >>> 16) % 100) / 100;
    const x = room.bounds.minX + margin + tx * (width  - margin * 2);
    const z = room.bounds.minZ + margin + tz * (depth  - margin * 2);
    const rotationY = ((h >>> 24) % 360) * (Math.PI / 180);

    const y = type === 'column'     ? 1.05
      : type === 'obelisk'          ? 0.80
        : type === 'amphora'        ? 0.28
          : type === 'skeleton'     ? 0.18
            : type === 'altar'      ? 0.14
              : type === 'rug'      ? 0.015
                : type === 'floorGlyph'  ? 0.011
                  : type === 'scarabTile' ? 0.006
                    : 0.16;

    const list = placementsByType.get(type) ?? [];
    list.push({
      type, x, y, z, rotationY,
      lying: type === 'skeleton' || type === 'rug',
    });
    placementsByType.set(type, list);
  }
}

function materialFor(
  type: DecorType,
  clayMaterial: THREE.Material,
  sandMaterial: THREE.Material,
  candleMaterial: THREE.Material,
  wallMaterial: THREE.Material,
  boneMaterial: THREE.Material,
  rugMaterial: THREE.Material,
  altarMaterial: THREE.Material,
  obeliskMaterial: THREE.Material,
  glyphMaterial: THREE.Material,
  scarabMaterial: THREE.Material,
): THREE.Material {
  switch (type) {
    case 'jar':
    case 'amphora':    return clayMaterial;
    case 'candle':     return candleMaterial;
    case 'sandpile':   return sandMaterial;
    case 'bones':
    case 'skeleton':   return boneMaterial;
    case 'rug':        return rugMaterial;
    case 'altar':      return altarMaterial;
    case 'obelisk':    return obeliskMaterial;
    case 'floorGlyph': return glyphMaterial;
    case 'scarabTile': return scarabMaterial;
    default:           return wallMaterial;
  }
}

/**
 * Posiziona 1–3 statue di granito agli angoli della stanza.
 * Silhouette di faraone seduto / Anubi: piedistallo + corpo + testa + nemes.
 */
function placeStatues(
  room: FloorSceneRoom,
  dungeonRoot: THREE.Group,
  mat: THREE.Material,
  seed: number,
): void {
  const { minX, maxX, minZ, maxZ } = room.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const geos = getStatueGeos();
  const margin = 1.3;

  const corners: readonly [number, number][] = [
    [minX + margin, minZ + margin],
    [maxX - margin, minZ + margin],
    [minX + margin, maxZ - margin],
    [maxX - margin, maxZ - margin],
  ];

  // Numero di statue: 1-3 basato sul seed
  const count = 1 + (hash32(seed, 0) % 3);

  for (let i = 0; i < Math.min(count, corners.length); i++) {
    const h = hash32(seed, i + 1);
    const cornerIdx = h % corners.length;
    const corner = corners[cornerIdx];
    if (!corner) continue;
    const [sx, sz] = corner;

    // Rotazione verso il centro della stanza
    const ry = Math.atan2(cx - sx, cz - sz);

    const addPart = (geo: THREE.BufferGeometry, ly: number, lx = 0, lz = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sx + lx, ly, sz + lz);
      mesh.rotation.y = ry;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      dungeonRoot.add(mesh);
    };

    addPart(geos.base,  0.09);                           // piedistallo
    addPart(geos.body,  0.44);                           // corpo seduto
    addPart(geos.head,  0.84);                           // testa
    addPart(geos.nemes, 1.02);                           // copricapo nemes
    // orecchie Anubi ai lati (offset locali → applicati prima della rotazione)
    const cosRy = Math.cos(ry);
    const sinRy = Math.sin(ry);
    const earOffX = 0.17 * cosRy;
    const earOffZ = -0.17 * sinRy;
    const ear = new THREE.Mesh(geos.ear, mat);
    ear.position.set(sx + earOffX, 1.10, sz + earOffZ);
    ear.rotation.y = ry;
    ear.castShadow = true;
    dungeonRoot.add(ear);
    const ear2 = new THREE.Mesh(geos.ear, mat);
    ear2.position.set(sx - earOffX, 1.10, sz - earOffZ);
    ear2.rotation.y = ry;
    ear2.castShadow = true;
    dungeonRoot.add(ear2);
  }
}

/**
 * Posiziona pannelli con geroglifici sulle pareti interne della stanza.
 * Ogni pannello: cornice di pietra + lastra incisa + tre registri di simboli.
 */
function placeWallPanels(
  room: FloorSceneRoom,
  dungeonRoot: THREE.Group,
  frameM: THREE.Material,
  insetM: THREE.Material,
  lineM: THREE.Material,
  seed: number,
): void {
  const { minX, maxX, minZ, maxZ } = room.bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const geos = getPanelGeos();

  // Definizione pareti: [baseX, baseZ, rotazioneY, asse variabile ('x'|'z'), lunghezza]
  // rotY: direzione della normale verso l'interno della stanza
  const walls = [
    // Parete nord (z=minZ) → normale verso +Z
    { bx: minX, bz: minZ + 0.03, ry: 0,            axis: 'x' as const, len: width },
    // Parete sud (z=maxZ) → normale verso -Z
    { bx: minX, bz: maxZ - 0.03, ry: Math.PI,      axis: 'x' as const, len: width },
    // Parete ovest (x=minX) → normale verso +X
    { bx: minX + 0.03, bz: minZ, ry:  Math.PI / 2, axis: 'z' as const, len: depth },
    // Parete est (x=maxX) → normale verso -X
    { bx: maxX - 0.03, bz: minZ, ry: -Math.PI / 2, axis: 'z' as const, len: depth },
  ];

  const cy = 1.22;    // altezza occhio

  for (let wi = 0; wi < walls.length; wi++) {
    const wall = walls[wi];
    if (!wall) continue;
    // 1 o 2 pannelli per parete, in posizioni al 33% e 66% della lunghezza
    const panelPositions = [0.33, 0.67];
    for (let pi = 0; pi < panelPositions.length; pi++) {
      const h = hash32(seed, wi * 10 + pi + 1);
      if ((h % 3) === 0) continue;  // salta ~33% per varietà

      const t = panelPositions[pi];
      if (t === undefined) continue;
      let px = wall.bx;
      let pz = wall.bz;
      if (wall.axis === 'x') px = wall.bx + t * wall.len;
      else pz = wall.bz + t * wall.len;

      // Vettore normale verso l'interno della stanza
      const nx = Math.sin(wall.ry);
      const nz = Math.cos(wall.ry);

      // Cornice (più profonda, addossata al muro)
      const frame = new THREE.Mesh(geos.frame, frameM);
      frame.position.set(px, cy, pz);
      frame.rotation.y = wall.ry;
      frame.receiveShadow = true;
      dungeonRoot.add(frame);

      // Lastra incisa (leggermente sporgente dalla cornice)
      const inset = new THREE.Mesh(geos.inset, insetM);
      inset.position.set(px + nx * 0.022, cy, pz + nz * 0.022);
      inset.rotation.y = wall.ry;
      inset.receiveShadow = true;
      dungeonRoot.add(inset);

      // Tre registri di simboli (linee orizzontali scolpite)
      const lineOffsets = [-0.14, 0, 0.14];
      for (const dy of lineOffsets) {
        const line = new THREE.Mesh(geos.line, lineM);
        line.position.set(px + nx * 0.034, cy + dy, pz + nz * 0.034);
        line.rotation.y = wall.ry;
        dungeonRoot.add(line);
      }
    }
  }
}
