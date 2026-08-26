/**
 * Scopo: SecretCryptStaircase — scalinata monumentale procedurale per cripte segrete.
 *        Permette di scendere fisicamente gradino dopo gradino sotto un monumento
 *        o un passaggio segreto per accedere a una camera inferiore ricca di tesori.
 * Ownership: rendering (Three.js e collisioni Rapier3D).
 */

import * as THREE from 'three';
import { buildCanopicJar, buildAltar } from '@/rendering/EgyptianLandmarks.js';

export interface SecretStaircaseInstance {
  readonly group: THREE.Group;
  readonly entryX: number;
  readonly entryZ: number;
  readonly cryptFloorY: number;
  dispose(): void;
}

export function buildSecretCryptStaircase(
  entryPos: { readonly x: number; readonly y: number; readonly z: number },
  directionAngleRad: number,
  wallMaterial: THREE.Material,
  createStaticBox?: (x: number, y: number, z: number, hx: number, hy: number, hz: number) => void,
): SecretStaircaseInstance {
  const group = new THREE.Group();
  group.position.set(entryPos.x, entryPos.y, entryPos.z);
  group.rotation.y = directionAngleRad;

  const stepCount = 10;
  const stepWidth = 1.6;
  const stepDepth = 0.38;
  const stepHeight = 0.24;
  const totalDrop = stepCount * stepHeight; // ~2.4m

  const goldTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4a036,
    metalness: 0.85,
    roughness: 0.28,
  });

  const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);

  // 1. GRADINI SCOLPITI
  for (let i = 0; i < stepCount; i++) {
    const stepMesh = new THREE.Mesh(stepGeo, wallMaterial);
    const stepY = -((i + 1) * stepHeight - stepHeight / 2);
    const stepZ = -(i * stepDepth + stepDepth / 2);

    stepMesh.position.set(0, stepY, stepZ);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    group.add(stepMesh);

    // Profilo dorato sul bordo del gradino
    const rimGeo = new THREE.BoxGeometry(stepWidth, 0.02, 0.04);
    const rimMesh = new THREE.Mesh(rimGeo, goldTrimMaterial);
    rimMesh.position.set(0, stepY + stepHeight / 2 - 0.01, stepZ - stepDepth / 2 + 0.02);
    group.add(rimMesh);

    // Collider fisico per salire e scendere gradino per gradino
    if (createStaticBox) {
      const worldZ = entryPos.z + stepZ * Math.cos(directionAngleRad);
      const worldX = entryPos.x + stepZ * Math.sin(directionAngleRad);
      createStaticBox(
        worldX,
        entryPos.y + stepY,
        worldZ,
        stepWidth / 2,
        stepHeight / 2,
        stepDepth / 2,
      );
    }
  }

  // 2. PARETI LATERALI INCLINATE DELLA DISCESA
  const wallLength = stepCount * stepDepth;
  const sideWallGeo = new THREE.BoxGeometry(0.25, totalDrop + 1.2, wallLength);
  
  const leftWall = new THREE.Mesh(sideWallGeo, wallMaterial);
  leftWall.position.set(-(stepWidth / 2 + 0.125), -totalDrop / 2, -wallLength / 2);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, wallMaterial);
  rightWall.position.set(stepWidth / 2 + 0.125, -totalDrop / 2, -wallLength / 2);
  group.add(rightWall);

  // 3. CRIPTA INFERIORE (Pavimento e Tesori alla base della scala)
  const cryptDepth = 4.5;
  const cryptWidth = 4.5;
  const cryptFloorY = -totalDrop;
  const cryptCenterZ = -(wallLength + cryptDepth / 2);

  const cryptFloorGeo = new THREE.BoxGeometry(cryptWidth, 0.2, cryptDepth);
  const cryptFloor = new THREE.Mesh(cryptFloorGeo, wallMaterial);
  cryptFloor.position.set(0, cryptFloorY - 0.1, cryptCenterZ);
  cryptFloor.receiveShadow = true;
  group.add(cryptFloor);

  // Tesori cerimoniali nella cripta (Vaso Canopo d'oro & Altare)
  const jar = buildCanopicJar(goldTrimMaterial);
  jar.position.set(-1.2, cryptFloorY, cryptCenterZ);
  jar.scale.set(0.65, 0.65, 0.65);
  group.add(jar);

  const altar = buildAltar(wallMaterial);
  altar.position.set(0, cryptFloorY, cryptCenterZ - 1.0);
  altar.scale.set(0.65, 0.65, 0.65);
  group.add(altar);

  // Lampada a olio con fiamma sulla base della scala
  const torchLight = new THREE.PointLight(0xffa23a, 8.0, 6.5);
  torchLight.position.set(0, cryptFloorY + 1.2, cryptCenterZ);
  group.add(torchLight);

  return {
    group,
    entryX: entryPos.x,
    entryZ: entryPos.z,
    cryptFloorY,
    dispose(): void {
      stepGeo.dispose();
      sideWallGeo.dispose();
      cryptFloorGeo.dispose();
      goldTrimMaterial.dispose();
    },
  };
}
