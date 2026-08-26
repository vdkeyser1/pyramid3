/**
 * Scopo: EgyptianMummyMesh — generatore procedurale per il modello 3D della Mummia Egizia.
 *        Risolve il problema della "mummia a bruco", fornendo un corpo antropomorfo
 *        completo di testa con maschera funeraria Nemes, collare Usekh, bende incrociate
 *        a rilievo, braccia protese minacciose e gambe mummificate.
 * Ownership: rendering (puro Three.js, geometrie condivise).
 */

import * as THREE from 'three';

const sharedGeo = new Map<string, THREE.BufferGeometry>();

function getSharedGeo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = sharedGeo.get(key);
  if (!g) {
    g = factory();
    sharedGeo.set(key, g);
  }
  return g;
}

export function buildProceduralMummyGroup(isRoyal = false): THREE.Group {
  const root = new THREE.Group();

  // Materiali: Lino antico invecchiato + Oro faraonico + Lapislazzuli + Occhi scuri
  const linenMaterial = new THREE.MeshStandardMaterial({
    color: isRoyal ? 0x9e8e70 : 0x8a7b62,
    roughness: 0.88,
    metalness: 0.05,
  });

  const goldTrimMaterial = new THREE.MeshStandardMaterial({
    color: isRoyal ? 0xecb842 : 0xcfa036,
    metalness: 0.85,
    roughness: 0.28,
    emissive: 0x3a2608,
    emissiveIntensity: 0.4,
  });

  const lapisMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a3c75,
    roughness: 0.4,
    metalness: 0.3,
  });

  const eyeGlowMaterial = new THREE.MeshStandardMaterial({
    color: isRoyal ? 0xff4422 : 0xddaa33,
    emissive: isRoyal ? 0xff2200 : 0xff8800,
    emissiveIntensity: 1.2,
  });

  // 1. GAMBE MUMMIFICATE (due gambe avvolte da fasce)
  const legGeo = getSharedGeo('mummy_leg', () => new THREE.CylinderGeometry(0.12, 0.14, 0.75, 8));
  const legLeft = new THREE.Mesh(legGeo, linenMaterial);
  legLeft.position.set(-0.16, 0.38, 0);
  legLeft.castShadow = true;
  legLeft.receiveShadow = true;
  root.add(legLeft);

  const legRight = new THREE.Mesh(legGeo, linenMaterial);
  legRight.position.set(0.16, 0.38, 0);
  legRight.castShadow = true;
  legRight.receiveShadow = true;
  root.add(legRight);

  // Fasce di lino a gradini sulle gambe
  const wrapRingGeo = getSharedGeo('mummy_wrap_ring', () => new THREE.TorusGeometry(0.135, 0.02, 6, 12));
  for (let y = 0.15; y <= 0.65; y += 0.15) {
    const ringL = new THREE.Mesh(wrapRingGeo, linenMaterial);
    ringL.rotation.x = Math.PI / 2 + 0.1;
    ringL.position.set(-0.16, y, 0);
    root.add(ringL);

    const ringR = new THREE.Mesh(wrapRingGeo, linenMaterial);
    ringR.rotation.x = Math.PI / 2 - 0.1;
    ringR.position.set(0.16, y, 0);
    root.add(ringR);
  }

  // 2. BACINO & TORSO (forma trapezoidale antropomorfa)
  const pelvisGeo = getSharedGeo('mummy_pelvis', () => new THREE.CylinderGeometry(0.24, 0.20, 0.25, 8));
  const pelvis = new THREE.Mesh(pelvisGeo, linenMaterial);
  pelvis.position.set(0, 0.82, 0);
  pelvis.castShadow = true;
  root.add(pelvis);

  const torsoGeo = getSharedGeo('mummy_torso', () => new THREE.CylinderGeometry(0.28, 0.22, 0.55, 8));
  const torso = new THREE.Mesh(torsoGeo, linenMaterial);
  torso.position.set(0, 1.18, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  root.add(torso);

  // Fasce incrociate sul petto (X-Bandage egizia)
  const chestCrossGeo = getSharedGeo('mummy_chest_cross', () => new THREE.BoxGeometry(0.48, 0.06, 0.28));
  const cross1 = new THREE.Mesh(chestCrossGeo, isRoyal ? goldTrimMaterial : linenMaterial);
  cross1.position.set(0, 1.22, 0.02);
  cross1.rotation.z = 0.45;
  root.add(cross1);

  const cross2 = new THREE.Mesh(chestCrossGeo, isRoyal ? goldTrimMaterial : linenMaterial);
  cross2.position.set(0, 1.22, 0.02);
  cross2.rotation.z = -0.45;
  root.add(cross2);

  // 3. COLLARE USEKH (pettorale a semicerchio cerimoniale)
  const collarGeo = getSharedGeo('mummy_collar', () => new THREE.CylinderGeometry(0.30, 0.32, 0.08, 10));
  const collar = new THREE.Mesh(collarGeo, goldTrimMaterial);
  collar.position.set(0, 1.44, 0);
  root.add(collar);

  // 4. BRACCIA PROTESE IN AVANTI (posa classica spaventosa)
  const armGeo = getSharedGeo('mummy_arm', () => new THREE.CylinderGeometry(0.09, 0.08, 0.55, 8));
  
  // Braccio sinistro
  const armLeft = new THREE.Mesh(armGeo, linenMaterial);
  armLeft.position.set(-0.34, 1.28, -0.22);
  armLeft.rotation.x = Math.PI / 2.3;
  armLeft.rotation.z = 0.15;
  armLeft.castShadow = true;
  root.add(armLeft);

  // Braccio destro
  const armRight = new THREE.Mesh(armGeo, linenMaterial);
  armRight.position.set(0.34, 1.28, -0.22);
  armRight.rotation.x = Math.PI / 2.3;
  armRight.rotation.z = -0.15;
  armRight.castShadow = true;
  root.add(armRight);

  // Avambracci / Mani a falange
  const handGeo = getSharedGeo('mummy_hand', () => new THREE.BoxGeometry(0.10, 0.08, 0.18));
  const handL = new THREE.Mesh(handGeo, isRoyal ? goldTrimMaterial : linenMaterial);
  handL.position.set(-0.34, 1.28, -0.52);
  root.add(handL);

  const handR = new THREE.Mesh(handGeo, isRoyal ? goldTrimMaterial : linenMaterial);
  handR.position.set(0.34, 1.28, -0.52);
  root.add(handR);

  // 5. TESTA SAGOMATA & COPRICAPO NEMES (maschera faraonica)
  const headGeo = getSharedGeo('mummy_head', () => new THREE.BoxGeometry(0.24, 0.28, 0.24));
  const head = new THREE.Mesh(headGeo, linenMaterial);
  head.position.set(0, 1.62, 0);
  head.castShadow = true;
  root.add(head);

  // Copricapo Nemes / Fascia Reale dorata
  const nemesCrownGeo = getSharedGeo('mummy_nemes', () => new THREE.BoxGeometry(0.30, 0.14, 0.28));
  const nemes = new THREE.Mesh(nemesCrownGeo, goldTrimMaterial);
  nemes.position.set(0, 1.74, -0.02);
  root.add(nemes);

  // Alette laterali del Nemes
  const flapGeo = getSharedGeo('mummy_flap', () => new THREE.BoxGeometry(0.06, 0.32, 0.18));
  const flapL = new THREE.Mesh(flapGeo, lapisMaterial);
  flapL.position.set(-0.16, 1.52, -0.02);
  root.add(flapL);

  const flapR = new THREE.Mesh(flapGeo, lapisMaterial);
  flapR.position.set(0.16, 1.52, -0.02);
  root.add(flapR);

  // Occhi luminescenti nell'oscurità (due fenditure ardenti)
  const eyeGeo = getSharedGeo('mummy_eye', () => new THREE.BoxGeometry(0.04, 0.03, 0.04));
  const eyeLeft = new THREE.Mesh(eyeGeo, eyeGlowMaterial);
  eyeLeft.position.set(-0.065, 1.64, -0.125);
  root.add(eyeLeft);

  const eyeRight = new THREE.Mesh(eyeGeo, eyeGlowMaterial);
  eyeRight.position.set(0.065, 1.64, -0.125);
  root.add(eyeRight);

  // Barba posticcia cerimoniale (se mummia reale)
  if (isRoyal) {
    const beardGeo = getSharedGeo('mummy_beard', () => new THREE.CylinderGeometry(0.025, 0.04, 0.22, 6));
    const beard = new THREE.Mesh(beardGeo, goldTrimMaterial);
    beard.position.set(0, 1.42, -0.12);
    beard.rotation.x = -0.2;
    root.add(beard);
  }

  // Centratura corretta: il pivot dei piedi poggia esattamente a y=0
  return root;
}
