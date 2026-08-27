/**
 * EgyptianTrapsMesh.ts
 * Generatore 3D per trappole mortali dell'Antico Egitto:
 * 1. Pendolo a Mezzaluna (Lama oscillante in bronzo e legno cerimoniale);
 * 2. Feritoie dei Dardi (Blocco murario con canne di lancia e dardi avvelenati);
 * 3. Piastra a Pressione Trabocchetto (Lastra di granito rialzata con fessure di polvere).
 */

import * as THREE from 'three';

export function createSwingingBladeMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'SwingingBladeTrap';

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xc49b5f,
    metalness: 0.9,
    roughness: 0.25,
    emissive: 0x3a2608,
    emissiveIntensity: 0.2,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x2e1e12,
    roughness: 0.85,
  });

  // Asta di sospensione dal soffitto (fulcro in (0, 0, 0))
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.8, 8), woodMat);
  shaft.position.y = -1.4;
  root.add(shaft);

  // Lama a mezzaluna in bronzo affilato
  const bladeGeo = new THREE.TorusGeometry(0.75, 0.12, 4, 16, Math.PI);
  const blade = new THREE.Mesh(bladeGeo, bronzeMat);
  blade.rotation.z = Math.PI / 2;
  blade.position.y = -2.8;
  root.add(blade);

  // Contrappeso dorato al fulcro
  const pivotHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), bronzeMat);
  pivotHub.rotation.x = Math.PI / 2;
  root.add(pivotHub);

  return root;
}

export function createDartWallTrapMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'DartWallTrap';

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x5a4830,
    roughness: 0.9,
  });

  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050403 });

  // Blocco di pietra frontale
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.15), stoneMat);
  root.add(panel);

  // Fori dei dardi (griglia 3x2)
  for (let row = -1; row <= 1; row++) {
    for (const col of [-0.28, 0.28]) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), holeMat);
      hole.position.set(col, row * 0.45, 0.08);
      root.add(hole);
    }
  }

  return root;
}

export function createPressurePlateMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'PressurePlateTrap';

  const stonePlateMat = new THREE.MeshStandardMaterial({
    color: 0x7c6344,
    roughness: 0.82,
  });

  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x3d2e1c,
    roughness: 0.95,
  });

  // Cornice a terra
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 1.4), borderMat);
  frame.position.y = 0.02;
  root.add(frame);

  // Lastra mobile rialzata
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 1.15), stonePlateMat);
  plate.position.y = 0.05;
  plate.name = 'MovablePlate';
  root.add(plate);

  return root;
}
