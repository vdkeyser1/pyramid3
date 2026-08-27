/**
 * GAME-ART-008 / G-30 — Boia di Anubi procedurale.
 *
 * Scopo: silhouette distinta da `statue_anubis.glb` (copia MD5 usata come
 *        anubis_executioner.glb). Sciacallo armato di khopesh, non statua
 *        funeraria. Fallback CC0-compatibile finché non arriva un GLB unico.
 * Ownership: rendering. Consumato da ThreeRendererService per ANUBIS_EXECUTIONER.
 */

import * as THREE from 'three';
import { createGoldMaterial } from '@/rendering/Materials.js';

export interface AnubisExecutionerMeshOptions {
  readonly scale?: number;
  readonly eyeIntensity?: number;
}

export function createEgyptianAnubisExecutionerMesh(
  options: AnubisExecutionerMeshOptions = {},
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'AnubisExecutionerMesh';

  const scale = options.scale ?? 1.55;
  const eyeIntensity = options.eyeIntensity ?? 2.4;

  const basalt = new THREE.MeshStandardMaterial({
    color: 0x0c0c10,
    roughness: 0.28,
    metalness: 0.72,
  });
  const gold = createGoldMaterial();
  gold.emissiveIntensity = 0.35;
  const linen = new THREE.MeshStandardMaterial({
    color: 0x4a1c18,
    roughness: 0.8,
    metalness: 0.08,
  });
  const eyes = new THREE.MeshStandardMaterial({
    color: 0xff2a18,
    emissive: 0xff1208,
    emissiveIntensity: eyeIntensity,
    roughness: 0.08,
  });

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.28, 10), linen);
  hips.position.y = 0.95;
  hips.castShadow = true;
  root.add(hips);

  const kilt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.7, 10), linen);
  kilt.position.y = 0.48;
  kilt.castShadow = true;
  root.add(kilt);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.32), basalt);
  torso.position.y = 1.38;
  torso.castShadow = true;
  root.add(torso);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.12, 16), gold);
  collar.position.y = 1.66;
  root.add(collar);

  const head = new THREE.Group();
  head.position.set(0, 1.92, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.36), basalt);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 4), basalt);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, -0.02, 0.32);
  head.add(snout);
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), basalt);
    ear.position.set(side * 0.14, 0.28, -0.04);
    ear.rotation.set(-0.2, 0, side * -0.22);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.09), eyes);
    eye.position.set(side * 0.12, 0.05, 0.16);
    head.add(eye);
  }
  root.add(head);

  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.72, 8), basalt);
  rArm.position.set(0.38, 1.28, 0.1);
  rArm.rotation.set(0.15, 0, -0.55);
  rArm.castShadow = true;
  root.add(rArm);

  const khopesh = new THREE.Group();
  khopesh.position.set(0.62, 0.95, 0.22);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 8), gold);
  grip.rotation.z = 0.4;
  khopesh.add(grip);
  const blade = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.035, 6, 14, Math.PI * 0.9),
    gold,
  );
  blade.rotation.set(Math.PI / 2, 0.4, 0);
  blade.position.set(0.18, 0.22, 0);
  khopesh.add(blade);
  root.add(khopesh);

  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.65, 8), basalt);
  lArm.position.set(-0.34, 1.22, 0.06);
  lArm.rotation.set(0.35, 0, 0.25);
  lArm.castShadow = true;
  root.add(lArm);

  root.scale.setScalar(scale);
  return root;
}
