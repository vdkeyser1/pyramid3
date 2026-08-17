/**
 * Scopo: decorazione procedurale delle stanze (G-14 residuo) — vasi, anfore,
 * candele, colonne e cumuli di sabbia piazzati deterministicamente nelle
 * stanze senza landmark. Nessun asset esterno: geometry + materiali condivisi.
 * Ownership: rendering. Consumato da ThreeDungeonLayout dopo i landmark.
 * Invarianti:
 *   - deterministico: hash32(seed, roomId, slot) → posizione/rotazione/tipo;
 *   - nessuna decorazione nelle stanze critiche (entry/exit/tesoro/mappa) e
 *     mai dentro i corridoi (solo room.bounds interni con margine);
 *   - oggetti puramente visivi (no collider) — la fisica non cambia.
 * Failure mode: stanze piccole → meno slot; materiali null → skip.
 */

import * as THREE from 'three';
import type { FloorSceneLayout, FloorSceneRoom } from '@/world/FloorSceneLayout.js';
import { hash32 } from '@/procedural/Hash32.js';

/** Stanze che restano volutamente spoglie (leggibilità della run). */
const CRITICAL_ROLES: readonly string[] = ['ENTRY', 'EXIT', 'MAP', 'TREASURE', 'FORGE'];

export interface DecorateRoomsOptions {
  readonly layout: FloorSceneLayout;
  readonly dungeonRoot: THREE.Group;
  readonly wallMaterial: THREE.Material;
  /** Colore terra/sabbia per i cumuli. */
  readonly sandColor?: number;
  /** Colore terracotta per i vasi. */
  readonly clayColor?: number;
  /** Colore oro per le candele. */
  readonly candleColor?: number;
  /**
   * v2: fascia tematica del piano (derivata da layout.floorIndex) — cambia la
   * probabilità dei tipi: più ossa/scheletri nella Cripta (piani alti), più
   * vasi/colonne nell'Anticamera (piani bassi).
   */
  readonly mood?: 'anticamera' | 'galleria' | 'cripta';
}

/** Oggetti decorativi per stanza: 2-4 slot deterministici. */
const DECOR_TYPES = ['jar', 'amphora', 'candle', 'column', 'sandpile', 'bones', 'skeleton', 'rug'] as const;
type DecorType = (typeof DECOR_TYPES)[number];

const SHARED_GEOMETRIES = new Map<DecorType, THREE.BufferGeometry>();

function geometryFor(type: DecorType): THREE.BufferGeometry {
  let geometry = SHARED_GEOMETRIES.get(type);
  if (geometry) {
    return geometry;
  }
  switch (type) {
    case 'jar':
      geometry = new THREE.SphereGeometry(0.22, 10, 8);
      break;
    case 'amphora':
      geometry = new THREE.ConeGeometry(0.16, 0.55, 8);
      break;
    case 'candle':
      geometry = new THREE.CylinderGeometry(0.045, 0.055, 0.32, 6);
      break;
    case 'column':
      geometry = new THREE.CylinderGeometry(0.16, 0.2, 2.1, 6);
      break;
    case 'bones':
      // Cumulo di ossa: 3 cilindri sottili incrociati
      geometry = new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5);
      break;
    case 'skeleton':
      // Scheletro sdraiato: capsula allungata (torso)
      geometry = new THREE.CapsuleGeometry(0.14, 0.7, 4, 8);
      break;
    case 'rug':
      // Tappeto usurato: cilindro piatto e largo
      geometry = new THREE.CylinderGeometry(0.85, 0.95, 0.03, 10);
      break;
    default:
      geometry = new THREE.ConeGeometry(0.35, 0.22, 7);
      break;
  }
  geometry.translate(0, 0, 0);
  SHARED_GEOMETRIES.set(type, geometry);
  return geometry;
}

interface DecorPlacement {
  readonly type: DecorType;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  /** True se l'oggetto giace sul pavimento (scheletro, tappeto). */
  readonly lying: boolean;
}

export function decorateRooms(options: DecorateRoomsOptions): void {
  const { layout, dungeonRoot, wallMaterial, sandColor = 0x8a7350, clayColor = 0x9c6b3c, candleColor = 0xd4a05a, mood } = options;

  // v2: mood per fascia — Cripta (piani 5+): ossa/scheletri dominano;
  // Anticamera (piani 1-2): vasi/colonne; Galleria: misto neutro.
  const moodIndex = mood === 'cripta' ? 1
    : mood === 'anticamera' ? 2
      : 0;

  const clayMaterial = new THREE.MeshStandardMaterial({
    color: clayColor,
    roughness: 0.85,
    metalness: 0.05,
  });
  const sandMaterial = new THREE.MeshStandardMaterial({
    color: sandColor,
    roughness: 1.0,
    metalness: 0.0,
  });
  const candleMaterial = new THREE.MeshStandardMaterial({
    color: candleColor,
    roughness: 0.6,
    metalness: 0.3,
    emissive: candleColor,
    emissiveIntensity: 0.35,
  });
  // PROP-1: ossa/scheletri (avorio sporco) e tappeti (lana scura)
  const boneMaterial = new THREE.MeshStandardMaterial({
    color: 0xcfc4a8,
    roughness: 0.9,
    metalness: 0.0,
  });
  const rugMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a3a28,
    roughness: 1.0,
    metalness: 0.0,
  });

  // Passo 1: raccogli i posizionamenti (stessa logica deterministica di
  // prima), senza creare mesh.
  const placementsByType = new Map<DecorType, DecorPlacement[]>();
  for (const room of layout.rooms) {
    if (CRITICAL_ROLES.includes(room.role)) {
      continue;
    }
    collectRoomPlacements(
      room,
      placementsByType,
      moodIndex,
    );
  }

  // Passo 2: un InstancedMesh per tipo — una draw call per tutte le istanze
  // (le colonne della Galleria non costano più draw call individuali).
  const dummy = new THREE.Object3D();
  for (const type of DECOR_TYPES) {
    const placements = placementsByType.get(type);
    if (placements === undefined || placements.length === 0) {
      continue;
    }
    const geometry = geometryFor(type);
    const material = materialFor(type, clayMaterial, sandMaterial, candleMaterial, wallMaterial, boneMaterial, rugMaterial);
    const instanced = new THREE.InstancedMesh(geometry, material, placements.length);
    for (let i = 0; i < placements.length; i++) {
      const placement = placements[i];
      if (placement === undefined) continue;
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(placement.lying ? Math.PI / 2 : 0, placement.rotationY, 0);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.castShadow = type !== 'rug';
    instanced.receiveShadow = true;
    dungeonRoot.add(instanced);
  }
}

function collectRoomPlacements(
  room: FloorSceneRoom,
  placementsByType: Map<DecorType, DecorPlacement[]>,
  moodIndex: number,
): void {
  const width = room.bounds.maxX - room.bounds.minX;
  const depth = room.bounds.maxZ - room.bounds.minZ;
  if (width < 5 || depth < 5) {
    return; // stanza troppo piccola
  }

  // v2: pool pesato per mood — Cripta: ossa/scheletri/rug dominano;
  // Anticamera: vasi/anfore/colonne; Galleria: neutro (pool completo).
  const pool: readonly DecorType[] = moodIndex === 1
    ? ['bones', 'bones', 'skeleton', 'rug', 'candle', 'jar']
    : moodIndex === 2
      ? ['jar', 'jar', 'amphora', 'column', 'candle', 'sandpile']
      : DECOR_TYPES;

  const slotCount = width >= 10 && depth >= 10 ? 4 : 2;
  for (let slot = 0; slot < slotCount; slot++) {
    const h = hash32(room.roomId, slot * 7 + 3);
    const type = pool[h % pool.length];
    if (type === undefined) continue;

    // Margine di 1.5m dai muri + spread deterministico (>>> = zero-fill)
    const tx = ((h >>> 8) % 100) / 100;
    const tz = ((h >>> 16) % 100) / 100;
    const x = room.bounds.minX + 1.5 + tx * (width - 3);
    const z = room.bounds.minZ + 1.5 + tz * (depth - 3);
    const rotationY = ((h >>> 24) % 360) * (Math.PI / 180);

    const y = type === 'column' ? 1.05
      : type === 'amphora' ? 0.28
        : type === 'skeleton' ? 0.18
          : type === 'rug' ? 0.015
            : 0.16;

    const list = placementsByType.get(type) ?? [];
    list.push({ type, x, y, z, rotationY, lying: type === 'skeleton' || type === 'rug' });
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
): THREE.Material {
  switch (type) {
    case 'jar':
    case 'amphora':
      return clayMaterial;
    case 'candle':
      return candleMaterial;
    case 'sandpile':
      return sandMaterial;
    case 'bones':
    case 'skeleton':
      return boneMaterial;
    case 'rug':
      return rugMaterial;
    default:
      return wallMaterial;
  }
}
