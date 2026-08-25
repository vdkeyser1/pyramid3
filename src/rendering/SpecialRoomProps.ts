/**
 * GAME-ART-008: props delle stanze speciali (arsenale, tesoreria, santuario).
 *
 * Scopo: tradurre i propId del catalogo SpecialRooms in mesh procedurali
 *   senza GLB obbligatori — silhouette leggibili e palette coerente.
 * Ownership: rendering. Consumato da ThreeRendererService dopo RoomDecor.
 * Invarianti: nessun Math.random; geometrie condivise; no collider.
 */

import * as THREE from 'three';
import type { FloorSceneSpecialProp } from '@/world/FloorSceneLayout.js';

const shared = new Map<string, THREE.BufferGeometry>();

function geo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = shared.get(key);
  if (!g) {
    g = factory();
    shared.set(key, g);
  }
  return g;
}

function materialFor(propId: string, wallMaterial: THREE.Material): THREE.Material {
  if (propId.includes('GOLD') || propId.includes('RA_') || propId.includes('SUN')) {
    return new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.65, roughness: 0.35 });
  }
  if (propId.includes('ANUBIS') || propId.includes('STATUE') || propId.includes('SARCOPHAGUS')) {
    return new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.15, roughness: 0.75 });
  }
  if (propId.includes('WEAPON') || propId.includes('SHIELD') || propId.includes('ARMOR')) {
    return new THREE.MeshStandardMaterial({ color: 0x6e6a62, metalness: 0.55, roughness: 0.4 });
  }
  if (propId.includes('TORCH') || propId.includes('LAMP') || propId.includes('INCENSE')) {
    return new THREE.MeshStandardMaterial({ color: 0xb07840, metalness: 0.2, roughness: 0.6 });
  }
  return wallMaterial;
}

function meshForProp(propId: string, wallMaterial: THREE.Material): THREE.Mesh {
  const mat = materialFor(propId, wallMaterial);
  let geometry: THREE.BufferGeometry;
  let y: number;

  if (propId.includes('RACK') || propId.includes('SHIELD_WALL')) {
    geometry = geo('rack', () => new THREE.BoxGeometry(0.25, 1.6, 1.1));
    y = 0.8;
  } else if (propId.includes('DUMMY') || propId.includes('ARMOR_STAND')) {
    geometry = geo('stand', () => new THREE.CylinderGeometry(0.18, 0.22, 1.5, 8));
    y = 0.75;
  } else if (propId.includes('STATUE') || propId.includes('PHARAOH')) {
    geometry = geo('statue', () => new THREE.BoxGeometry(0.55, 1.9, 0.45));
    y = 0.95;
  } else if (propId.includes('ALTAR') || propId.includes('SUN_DISK')) {
    geometry = geo('altar', () => new THREE.CylinderGeometry(0.55, 0.65, 0.45, 10));
    y = 0.25;
  } else if (propId.includes('CHEST') || propId.includes('GOLD_PILE')) {
    geometry = geo('chest', () => new THREE.BoxGeometry(0.7, 0.4, 0.45));
    y = 0.2;
  } else if (propId.includes('SARCOPHAGUS')) {
    geometry = geo('sarc', () => new THREE.BoxGeometry(0.9, 0.55, 2.0));
    y = 0.3;
  } else if (propId.includes('CANOPIC') || propId.includes('BOWL')) {
    geometry = geo('jar', () => new THREE.CylinderGeometry(0.12, 0.18, 0.4, 8));
    y = 0.2;
  } else if (propId.includes('PILLAR')) {
    geometry = geo('pillar', () => new THREE.CylinderGeometry(0.2, 0.24, 2.4, 8));
    y = 1.2;
  } else if (propId.includes('PANEL') || propId.includes('PAPYRUS')) {
    geometry = geo('panel', () => new THREE.BoxGeometry(0.08, 1.2, 0.9));
    y = 1.1;
  } else if (propId.includes('TORCH') || propId.includes('LAMP') || propId.includes('INCENSE')) {
    geometry = geo('torch', () => new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6));
    y = 1.2;
  } else if (propId.includes('PRESSURE_PLATE')) {
    // Visivo solo: la trappola vera è già in TrapSystem via deriveTraps.
    geometry = geo('plate', () => new THREE.BoxGeometry(1.0, 0.04, 1.0));
    y = 0.02;
  } else {
    geometry = geo('default', () => new THREE.BoxGeometry(0.4, 0.5, 0.4));
    y = 0.25;
  }

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Piazza i props della stanza speciale sotto `dungeonRoot`.
 * Restituisce il gruppo creato (o null se non ci sono props).
 */
export function placeSpecialRoomProps(
  props: readonly FloorSceneSpecialProp[],
  dungeonRoot: THREE.Group,
  wallMaterial: THREE.Material,
): THREE.Group | null {
  if (props.length === 0) return null;

  const group = new THREE.Group();
  group.name = 'special-room-props';

  for (const prop of props) {
    const mesh = meshForProp(prop.propId, wallMaterial);
    mesh.position.x = prop.position.x;
    mesh.position.z = prop.position.z;
    mesh.rotation.y = prop.yawRad;
    mesh.scale.setScalar(prop.scale);
    mesh.name = `special:${prop.propId}`;
    group.add(mesh);
  }

  dungeonRoot.add(group);
  return group;
}
