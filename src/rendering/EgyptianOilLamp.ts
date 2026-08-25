/**
 * Lampada a olio egizia per la torcia posata a terra.
 *
 * Sostituisce il GLB KayKit `torch_lit` (silhouette medievale) e il cilindro
 * placeholder. Silhouette: piedistallo + coppa + fiamma — coerente con ART_BIBLE.
 */

import * as THREE from 'three';

export interface PlacedOilLamp {
  readonly group: THREE.Group;
  /** Materiale condiviso con la palette `placedTorch*` (AccessibilityPalette). */
  readonly bodyMaterial: THREE.MeshStandardMaterial;
}

export function createPlacedOilLamp(bodyMaterial: THREE.MeshStandardMaterial): PlacedOilLamp {
  const group = new THREE.Group();
  group.name = 'placed-oil-lamp';

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.32), bodyMaterial);
  base.position.y = 0.04;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.42, 8), bodyMaterial);
  stem.position.y = 0.31;
  group.add(stem);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.14, 12), bodyMaterial);
  bowl.position.y = 0.58;
  group.add(bowl);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 16), bodyMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.64;
  group.add(rim);

  const flameMat = bodyMaterial.clone();
  flameMat.emissive = new THREE.Color(0xff8a20);
  flameMat.emissiveIntensity = 1.1;
  flameMat.color.setHex(0xffc060);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), flameMat);
  flame.position.y = 0.76;
  group.add(flame);

  for (const child of group.children) {
    child.castShadow = true;
    child.receiveShadow = true;
  }

  return { group, bodyMaterial };
}
