/**
 * GAME-ART-010 / G-22 — istanzia i DecoProp di ProceduralDecorator in scena.
 *
 * Scopo: cablare decorateRoom() nel pipeline delle stanze senza toccare la UI.
 *        I meshKey senza GLB Sketchfab ricadono su landmark procedurali già
 *        in repo (vaso canopo, altare, trono, anfora, sarcofago).
 * Ownership: rendering. Consumato da ThreeRendererService dopo RoomDecor.
 * Invarianti: deterministico (stesso seed del piano); nessuna stanza critica.
 * Failure mode: meshKey sconosciuta → anfora procedurale.
 */

import * as THREE from 'three';
import { decorateRoom, tilesFromBounds } from '@/content/ProceduralDecorator.js';
import { resolveRoomArchetype } from '@/content/RoomArchetypes.js';
import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';
import {
  buildAltar,
  buildCanopicJar,
  buildSarcophagus,
  buildStatue,
} from '@/rendering/EgyptianLandmarks.js';
import { createGoldMaterial } from '@/rendering/Materials.js';

const CRITICAL_ROLES: readonly string[] = ['ENTRY', 'EXIT', 'MAP', 'TREASURE', 'FORGE'];

export interface PlaceArchetypeDecorOptions {
  readonly layout: FloorSceneLayout;
  readonly dungeonRoot: THREE.Group;
  readonly wallMaterial: THREE.Material;
}

const sharedGeo = new Map<string, THREE.BufferGeometry>();

function geo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = sharedGeo.get(key);
  if (!g) {
    g = factory();
    sharedGeo.set(key, g);
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

function buildThrone(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(geo('throne_seat', () => new THREE.BoxGeometry(0.85, 0.22, 0.7)), mat);
  seat.position.y = 0.55;
  g.add(seat);
  const back = new THREE.Mesh(geo('throne_back', () => new THREE.BoxGeometry(0.85, 1.15, 0.16)), mat);
  back.position.set(0, 1.15, -0.28);
  g.add(back);
  const base = new THREE.Mesh(geo('throne_base', () => new THREE.BoxGeometry(0.95, 0.18, 0.8)), mat);
  base.position.y = 0.09;
  g.add(base);
  markShadows(g);
  return g;
}

function buildAmphora(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo('amph_body', () => new THREE.CylinderGeometry(0.12, 0.2, 0.55, 8)), mat);
  body.position.y = 0.28;
  g.add(body);
  const neck = new THREE.Mesh(geo('amph_neck', () => new THREE.CylinderGeometry(0.07, 0.12, 0.16, 8)), mat);
  neck.position.y = 0.62;
  g.add(neck);
  markShadows(g);
  return g;
}

function buildBanner(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(geo('ban_pole', () => new THREE.CylinderGeometry(0.03, 0.035, 2.2, 6)), mat);
  pole.position.y = 1.1;
  g.add(pole);
  const cloth = new THREE.Mesh(geo('ban_cloth', () => new THREE.PlaneGeometry(0.7, 1.1)), mat);
  cloth.position.set(0.28, 1.45, 0);
  g.add(cloth);
  markShadows(g);
  return g;
}

interface DecorMaterials {
  readonly wall: THREE.Material;
  readonly clay: THREE.Material;
  readonly gold: THREE.Material;
  readonly bone: THREE.Material;
}

function meshForKey(meshKey: string, mats: DecorMaterials): THREE.Object3D {
  const clay = mats.clay;
  const stone = mats.wall;
  const gold = mats.gold;
  const bone = mats.bone;

  switch (meshKey) {
    case 'sarcophagus':
      return buildSarcophagus(stone, 'CLOSED');
    case 'canopic_jar':
      return buildCanopicJar(clay);
    case 'altar':
      return buildAltar(stone);
    case 'throne':
      return buildThrone(gold);
    case 'statue_anubis':
      return buildStatue(stone);
    case 'amphora':
    case 'crate':
      return buildAmphora(clay);
    case 'column_egyptian':
    case 'broken_column': {
      const col = new THREE.Mesh(geo('col_eg', () => new THREE.CylinderGeometry(0.18, 0.22, 2.2, 8)), stone);
      col.position.y = 1.1;
      col.castShadow = true;
      col.receiveShadow = true;
      return col;
    }
    case 'banner':
      return buildBanner(gold);
    case 'urn_gold':
    case 'coin_pile': {
      const urn = buildCanopicJar(gold);
      urn.scale.setScalar(0.45);
      return urn;
    }
    case 'chest': {
      const g = new THREE.Group();
      const box = new THREE.Mesh(geo('deco_chest', () => new THREE.BoxGeometry(0.7, 0.4, 0.48)), gold);
      box.position.y = 0.22;
      g.add(box);
      markShadows(g);
      return g;
    }
    case 'bone_pile':
    case 'scarab_nest':
    case 'egg_cluster':
    case 'web': {
      const pile = new THREE.Mesh(geo('deco_pile', () => new THREE.DodecahedronGeometry(0.28, 0)), bone);
      pile.position.y = 0.16;
      pile.castShadow = true;
      return pile;
    }
    case 'rubble':
    case 'dust_cloud': {
      const rubble = new THREE.Mesh(geo('deco_rubble', () => new THREE.DodecahedronGeometry(0.32, 0)), stone);
      rubble.position.y = 0.14;
      rubble.castShadow = true;
      return rubble;
    }
    case 'incense_burner': {
      const g = new THREE.Group();
      const bowl = new THREE.Mesh(geo('inc_bowl', () => new THREE.CylinderGeometry(0.12, 0.08, 0.16, 8)), gold);
      bowl.position.y = 0.12;
      g.add(bowl);
      markShadows(g);
      return g;
    }
    default:
      return buildAmphora(clay);
  }
}

/**
 * Piazza i props di decorateRoom() per ogni stanza non critica del piano.
 */
export function placeArchetypeDecor(options: PlaceArchetypeDecorOptions): THREE.Group {
  const { layout, dungeonRoot, wallMaterial } = options;
  const root = new THREE.Group();
  root.name = 'archetype-decor';

  const seed = layout.floorIndex * 9973;
  const mats: DecorMaterials = {
    wall: wallMaterial,
    clay: new THREE.MeshStandardMaterial({ color: 0x9c6b3c, roughness: 0.82, metalness: 0.06 }),
    gold: createGoldMaterial(),
    bone: new THREE.MeshStandardMaterial({ color: 0xcfc4a8, roughness: 0.9, metalness: 0 }),
  };

  for (const room of layout.rooms) {
    if (CRITICAL_ROLES.includes(room.role)) continue;

    const archetype = resolveRoomArchetype(
      layout.floorIndex,
      Number(room.roomId),
      room.role,
      room.theme,
    );
    const tiles = tilesFromBounds(
      room.bounds.minX,
      room.bounds.minZ,
      room.bounds.maxX,
      room.bounds.maxZ,
    );
    if (tiles.length === 0) continue;

    const deco = decorateRoom(archetype, tiles, seed + Number(room.roomId));
    for (const prop of deco.props) {
      const obj = meshForKey(prop.meshKey, mats);
      obj.position.set(prop.position[0], prop.position[1], prop.position[2]);
      obj.rotation.set(prop.rotation[0], prop.rotation[1], prop.rotation[2]);
      obj.scale.multiplyScalar(prop.scale);
      obj.castShadow = prop.castShadow;
      obj.name = `deco:${prop.meshKey}`;
      root.add(obj);
    }

    const maxTorches = 3;
    for (let i = 0; i < Math.min(deco.torches.length, maxTorches); i++) {
      const t = deco.torches[i];
      if (!t) continue;
      const light = new THREE.PointLight(0xff9b30, 0.85, 4.2, 2);
      light.position.set(t[0], t[1], t[2]);
      root.add(light);
    }
  }

  dungeonRoot.add(root);
  return root;
}
