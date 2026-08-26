/**
 * GAME-ART-008: props delle stanze speciali — silhouette EGIZIE.
 *
 * Scopo: arsenale/tesoreria/santuario leggono come cripta funeraria, non
 *   taverna fantasy (niente rack medievali / scudi tondi da dungeon).
 * Ownership: rendering. Consumato da ThreeRendererService dopo RoomDecor.
 * Invarianti: nessun Math.random; geometrie condivise; no collider.
 */

import * as THREE from 'three';
import type { FloorSceneSpecialProp } from '@/world/FloorSceneLayout.js';
import {
  buildAltar,
  buildCanopicJar,
  buildHorusStatue,
  buildSarcophagus,
  buildStatue,
} from '@/rendering/EgyptianLandmarks.js';
import type { LodManager } from '@/rendering/LodManager.js';

const shared = new Map<string, THREE.BufferGeometry>();

function geo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = shared.get(key);
  if (!g) {
    g = factory();
    shared.set(key, g);
  }
  return g;
}

function markShadows(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function materialFor(propId: string, wallMaterial: THREE.Material): THREE.Material {
  if (propId.includes('GOLD') || propId.includes('RA_') || propId.includes('SUN')) {
    return new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.65, roughness: 0.35 });
  }
  if (propId.includes('ANUBIS') || propId.includes('STATUE') || propId.includes('SARCOPHAGUS')) {
    return new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.15, roughness: 0.75 });
  }
  if (propId.includes('WEAPON') || propId.includes('SHIELD') || propId.includes('ARMOR') || propId.includes('KHOPESH')) {
    return new THREE.MeshStandardMaterial({ color: 0x8a7348, metalness: 0.45, roughness: 0.42 });
  }
  if (propId.includes('TORCH') || propId.includes('LAMP') || propId.includes('INCENSE') || propId.includes('OIL')) {
    return new THREE.MeshStandardMaterial({
      color: 0xb07840,
      metalness: 0.2,
      roughness: 0.55,
      emissive: 0x3a1808,
      emissiveIntensity: 0.35,
    });
  }
  return wallMaterial;
}

/** Supporto per lance/khopesh: pilastrino + lame curve (non rack da taverna). */
function buildWeaponStand(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(geo('w_post', () => new THREE.BoxGeometry(0.18, 1.55, 0.18)), mat);
  post.position.y = 0.78;
  g.add(post);
  const base = new THREE.Mesh(geo('w_base', () => new THREE.BoxGeometry(0.55, 0.12, 0.4)), mat);
  base.position.y = 0.06;
  g.add(base);
  // Tre aste (lancia / asta / khopesh stilizzato).
  for (let i = 0; i < 3; i++) {
    const shaft = new THREE.Mesh(
      geo('w_shaft', () => new THREE.CylinderGeometry(0.025, 0.03, 1.35, 6)),
      mat,
    );
    shaft.position.set(-0.18 + i * 0.18, 0.85, 0.12);
    shaft.rotation.z = (i - 1) * 0.08;
    g.add(shaft);
    // Lama curva (khopesh): arco basso = silhouette egizia.
    const blade = new THREE.Mesh(
      geo('w_blade', () => new THREE.TorusGeometry(0.22, 0.035, 4, 10, Math.PI * 0.85)),
      mat,
    );
    blade.position.set(-0.18 + i * 0.18, 1.45, 0.12);
    blade.rotation.set(Math.PI / 2, 0, Math.PI * 0.15);
    g.add(blade);
  }
  markShadows(g);
  return g;
}

/** Scudo a disco con umbone — tipico dello scudo egizio, non kite medievale. */
function buildEgyptianShield(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(geo('sh_disc', () => new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16)), mat);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 1.1, 0);
  g.add(disc);
  const boss = new THREE.Mesh(geo('sh_boss', () => new THREE.SphereGeometry(0.12, 8, 6)), mat);
  boss.position.set(0, 1.1, 0.08);
  g.add(boss);
  const stand = new THREE.Mesh(geo('sh_stand', () => new THREE.BoxGeometry(0.12, 1.0, 0.12)), mat);
  stand.position.y = 0.5;
  g.add(stand);
  markShadows(g);
  return g;
}

/** Manichino d'addestramento: palo + busto di lino (non "training dummy" fantasy). */
function buildTrainingPost(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(geo('td_pole', () => new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8)), mat);
  pole.position.y = 0.8;
  g.add(pole);
  const torso = new THREE.Mesh(geo('td_torso', () => new THREE.CylinderGeometry(0.22, 0.28, 0.7, 8)), mat);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(geo('td_head', () => new THREE.SphereGeometry(0.16, 8, 6)), mat);
  head.position.y = 1.65;
  g.add(head);
  markShadows(g);
  return g;
}

/** Stand con corazza a scaglie + nemes — arsenale del tempio, non armadio. */
function buildArmorStand(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(geo('ar_post', () => new THREE.CylinderGeometry(0.06, 0.08, 1.7, 8)), mat);
  post.position.y = 0.85;
  g.add(post);
  const cuirass = new THREE.Mesh(geo('ar_cuir', () => new THREE.CylinderGeometry(0.28, 0.32, 0.85, 10)), mat);
  cuirass.position.y = 1.1;
  g.add(cuirass);
  const nemes = new THREE.Mesh(geo('ar_nemes', () => new THREE.CylinderGeometry(0.26, 0.18, 0.35, 6)), mat);
  nemes.position.y = 1.75;
  g.add(nemes);
  markShadows(g);
  return g;
}

/**
 * Falsa porta funeraria: cornice a rientranza + rullo centrale + cavetto.
 * Firma tipica delle tombe egizie (non portale fantasy).
 */
function buildFalseDoor(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(geo('fd_outer', () => new THREE.BoxGeometry(1.35, 2.2, 0.12)), mat);
  outer.position.y = 1.1;
  g.add(outer);
  const mid = new THREE.Mesh(geo('fd_mid', () => new THREE.BoxGeometry(1.05, 1.85, 0.1)), mat);
  mid.position.set(0, 1.05, 0.04);
  g.add(mid);
  const inner = new THREE.Mesh(geo('fd_inner', () => new THREE.BoxGeometry(0.72, 1.45, 0.08)), mat);
  inner.position.set(0, 0.95, 0.08);
  g.add(inner);
  // Rullo / "rolling" centrale.
  const roll = new THREE.Mesh(geo('fd_roll', () => new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8)), mat);
  roll.position.set(0, 0.95, 0.14);
  g.add(roll);
  // Cavetto cornice in cima.
  const cavetto = new THREE.Mesh(geo('fd_cav', () => new THREE.BoxGeometry(1.5, 0.18, 0.22)), mat);
  cavetto.position.set(0, 2.25, 0.05);
  g.add(cavetto);
  markShadows(g);
  return g;
}

/** Lampada a olio: coppa su piedistallo (non torcia a staffa medievale). */
function buildOilLamp(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(geo('ol_stem', () => new THREE.CylinderGeometry(0.04, 0.06, 0.55, 6)), mat);
  stem.position.y = 0.35;
  g.add(stem);
  const bowl = new THREE.Mesh(geo('ol_bowl', () => new THREE.CylinderGeometry(0.14, 0.1, 0.12, 10)), mat);
  bowl.position.y = 0.68;
  g.add(bowl);
  const flame = new THREE.Mesh(
    geo('ol_flame', () => new THREE.ConeGeometry(0.04, 0.14, 5)),
    mat,
  );
  flame.position.y = 0.82;
  g.add(flame);
  markShadows(g);
  return g;
}

/** Pila d'oro / offerte: dischi impilati, non forziere di legno. */
function buildOfferingPile(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const disc = new THREE.Mesh(
      geo('gp_disc', () => new THREE.CylinderGeometry(0.28 - i * 0.03, 0.3 - i * 0.03, 0.08, 12)),
      mat,
    );
    disc.position.y = 0.06 + i * 0.09;
    g.add(disc);
  }
  markShadows(g);
  return g;
}

function wrapScaled(source: THREE.Group, scale: number): THREE.Group {
  const wrap = new THREE.Group();
  wrap.add(source);
  wrap.scale.setScalar(scale);
  return wrap;
}

function objectForProp(propId: string, wallMaterial: THREE.Material): THREE.Object3D {
  const mat = materialFor(propId, wallMaterial);

  if (propId.includes('CANOPIC')) {
    return wrapScaled(buildCanopicJar(mat), 0.55);
  }
  if (propId.includes('ALTAR') || propId.includes('SUN_DISK')) {
    return wrapScaled(buildAltar(mat), 0.55);
  }
  if (propId.includes('SARCOPHAGUS')) {
    const variant = propId.includes('GOLD')
      ? 'ROYAL_GOLD'
      : propId.includes('BROKEN')
        ? 'BROKEN'
        : propId.includes('OPEN')
          ? 'OPEN'
          : 'CLOSED';
    return wrapScaled(buildSarcophagus(mat, variant), 0.7);
  }
  if (propId.includes('HORUS') || propId.includes('FALCON')) {
    const variant = propId.includes('GOLD')
      ? 'GOLD'
      : propId.includes('BASALT')
        ? 'BASALT'
        : 'SANDSTONE';
    return wrapScaled(buildHorusStatue(mat, variant), 0.75);
  }
  if (propId.includes('STATUE') || propId.includes('PHARAOH')) {
    return wrapScaled(buildStatue(mat), 0.75);
  }
  if (propId.includes('FALSE_DOOR') || propId.includes('HIEROGLYPH_WALL')) {
    return buildFalseDoor(mat);
  }
  if (propId.includes('RACK') || propId.includes('WEAPON')) {
    return buildWeaponStand(mat);
  }
  if (propId.includes('SHIELD')) {
    return buildEgyptianShield(mat);
  }
  if (propId.includes('DUMMY') || propId.includes('TRAINING')) {
    return buildTrainingPost(mat);
  }
  if (propId.includes('ARMOR')) {
    return buildArmorStand(mat);
  }
  if (propId.includes('TORCH') || propId.includes('LAMP') || propId.includes('INCENSE') || propId.includes('OIL')) {
    return buildOilLamp(mat);
  }
  if (propId.includes('GOLD_PILE') || propId.includes('OFFERING')) {
    return buildOfferingPile(mat);
  }
  if (propId.includes('CHEST')) {
    // Reliquiario a cassa di pietra (non forziere di legno KayKit).
    const g = new THREE.Group();
    const box = new THREE.Mesh(geo('chest_box', () => new THREE.BoxGeometry(0.75, 0.45, 0.5)), mat);
    box.position.y = 0.28;
    g.add(box);
    const lid = new THREE.Mesh(geo('chest_lid', () => new THREE.BoxGeometry(0.78, 0.12, 0.52)), mat);
    lid.position.y = 0.55;
    g.add(lid);
    markShadows(g);
    return g;
  }
  if (propId.includes('PILLAR')) {
    const mesh = new THREE.Mesh(geo('pillar', () => new THREE.CylinderGeometry(0.2, 0.24, 2.4, 8)), mat);
    mesh.position.y = 1.2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  if (propId.includes('PAPYRUS') || propId.includes('PANEL')) {
    return buildFalseDoor(mat);
  }
  if (propId.includes('PRESSURE_PLATE')) {
    const mesh = new THREE.Mesh(geo('plate', () => new THREE.BoxGeometry(1.0, 0.04, 1.0)), mat);
    mesh.position.y = 0.02;
    mesh.receiveShadow = true;
    return mesh;
  }
  if (propId.includes('BOWL')) {
    return wrapScaled(buildCanopicJar(mat), 0.35);
  }

  const fallback = new THREE.Mesh(geo('default', () => new THREE.BoxGeometry(0.4, 0.5, 0.4)), mat);
  fallback.position.y = 0.25;
  fallback.castShadow = true;
  return fallback;
}

/**
 * Piazza i props della stanza speciale sotto `dungeonRoot`.
 * I props egizi sono Group compositi: niente LOD mesh-only (evita cast unsafe).
 */
export function placeSpecialRoomProps(
  props: readonly FloorSceneSpecialProp[],
  dungeonRoot: THREE.Group,
  wallMaterial: THREE.Material,
  _lodManager?: LodManager | null,
): THREE.Group | null {
  if (props.length === 0) return null;

  const group = new THREE.Group();
  group.name = 'special-room-props';

  for (const prop of props) {
    const obj = objectForProp(prop.propId, wallMaterial);
    obj.rotation.y = prop.yawRad;
    obj.scale.multiplyScalar(prop.scale);
    obj.name = `special:${prop.propId}`;
    obj.position.x = prop.position.x;
    obj.position.z = prop.position.z;
    group.add(obj);
  }

  dungeonRoot.add(group);
  return group;
}
