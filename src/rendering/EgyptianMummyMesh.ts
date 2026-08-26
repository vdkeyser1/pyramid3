/**
 * Scopo: EgyptianMummyMesh — generatore 3D di altissima fedeltà per la Mummia Egizia.
 *        Silhouette faraonica autentica: copricapo Nemes con Ureo reale (cobra dorato sulla fronte),
 *        costole visibili sotto le bende, lembi di lino pendenti, collare Usekh di lapislazzuli,
 *        dita artigliate mummificate e orbite oculari profonde con bagliore spirituale Ka.
 * Ownership: rendering (puro Three.js con geometrie condivise).
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

  // Materiali PBR con finiture di alto livello
  const linenMaterial = new THREE.MeshStandardMaterial({
    color: isRoyal ? 0xa8997a : 0x82735b,
    roughness: 0.92,
    metalness: 0.04,
    bumpScale: 0.05,
  });

  const linenDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4d3e2d,
    roughness: 0.95,
    metalness: 0.02,
  });

  const goldTrimMaterial = new THREE.MeshStandardMaterial({
    color: isRoyal ? 0xf5c342 : 0xd4a233,
    metalness: 0.90,
    roughness: 0.22,
    emissive: 0x4a320c,
    emissiveIntensity: 0.45,
  });

  const lapisMaterial = new THREE.MeshStandardMaterial({
    color: 0x13386e,
    roughness: 0.35,
    metalness: 0.4,
  });

  const eyeGlowMaterial = new THREE.MeshStandardMaterial({
    color: isRoyal ? 0xff3311 : 0xffaa22,
    emissive: isRoyal ? 0xff2200 : 0xff7700,
    emissiveIntensity: 2.0,
  });

  // 1. GAMBE MUMMIFICATE & PIEDI ARTIGLIATI
  const legGeo = getSharedGeo('mummy_v2_leg', () => new THREE.CylinderGeometry(0.11, 0.13, 0.76, 8));
  
  const legLeft = new THREE.Mesh(legGeo, linenMaterial);
  legLeft.position.set(-0.16, 0.38, 0);
  legLeft.rotation.x = -0.05;
  legLeft.castShadow = true;
  legLeft.receiveShadow = true;
  root.add(legLeft);

  const legRight = new THREE.Mesh(legGeo, linenMaterial);
  legRight.position.set(0.16, 0.38, 0);
  legRight.rotation.x = 0.08; // Posa asimmetrica claudicante
  legRight.castShadow = true;
  legRight.receiveShadow = true;
  root.add(legRight);

  // Piedi fasciati con dita mummificate scure
  const footGeo = getSharedGeo('mummy_v2_foot', () => new THREE.BoxGeometry(0.12, 0.09, 0.24));
  const footL = new THREE.Mesh(footGeo, linenDarkMaterial);
  footL.position.set(-0.16, 0.045, -0.06);
  root.add(footL);

  const footR = new THREE.Mesh(footGeo, linenDarkMaterial);
  footR.position.set(0.16, 0.045, -0.04);
  root.add(footR);

  // Anelli di bende a gradini
  const wrapRingGeo = getSharedGeo('mummy_v2_ring', () => new THREE.TorusGeometry(0.135, 0.022, 6, 12));
  for (let y = 0.12; y <= 0.68; y += 0.14) {
    const ringL = new THREE.Mesh(wrapRingGeo, linenMaterial);
    ringL.rotation.x = Math.PI / 2 + 0.12;
    ringL.position.set(-0.16, y, 0);
    root.add(ringL);

    const ringR = new THREE.Mesh(wrapRingGeo, linenMaterial);
    ringR.rotation.x = Math.PI / 2 - 0.08;
    ringR.position.set(0.16, y, 0);
    root.add(ringR);
  }

  // 2. BACINO & TORSO SCHELETRICO (Costole a rilievo)
  const pelvisGeo = getSharedGeo('mummy_v2_pelvis', () => new THREE.CylinderGeometry(0.23, 0.19, 0.24, 8));
  const pelvis = new THREE.Mesh(pelvisGeo, linenMaterial);
  pelvis.position.set(0, 0.82, 0);
  pelvis.castShadow = true;
  root.add(pelvis);

  const torsoGeo = getSharedGeo('mummy_v2_torso', () => new THREE.CylinderGeometry(0.27, 0.21, 0.56, 8));
  const torso = new THREE.Mesh(torsoGeo, linenDarkMaterial);
  torso.position.set(0, 1.18, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  root.add(torso);

  // Costole e bende orizzontali strette sul petto
  const ribGeo = getSharedGeo('mummy_v2_rib', () => new THREE.CylinderGeometry(0.275, 0.275, 0.05, 8));
  for (let rY = 1.02; rY <= 1.34; rY += 0.08) {
    const rib = new THREE.Mesh(ribGeo, linenMaterial);
    rib.position.set(0, rY, 0);
    root.add(rib);
  }

  // Bende incrociate diagonali a "X" faraonica
  const crossGeo = getSharedGeo('mummy_v2_cross', () => new THREE.BoxGeometry(0.46, 0.05, 0.28));
  const cross1 = new THREE.Mesh(crossGeo, isRoyal ? goldTrimMaterial : linenMaterial);
  cross1.position.set(0, 1.20, 0.015);
  cross1.rotation.z = 0.52;
  root.add(cross1);

  const cross2 = new THREE.Mesh(crossGeo, isRoyal ? goldTrimMaterial : linenMaterial);
  cross2.position.set(0, 1.20, 0.015);
  cross2.rotation.z = -0.52;
  root.add(cross2);

  // 3. COLLARE USEKH CERIMONIALE (Oro e Lapislazzuli)
  const collarGeo = getSharedGeo('mummy_v2_collar', () => new THREE.CylinderGeometry(0.30, 0.33, 0.09, 12));
  const collar = new THREE.Mesh(collarGeo, goldTrimMaterial);
  collar.position.set(0, 1.45, 0);
  root.add(collar);

  const collarTrimGeo = getSharedGeo('mummy_v2_collar_trim', () => new THREE.TorusGeometry(0.31, 0.02, 6, 16));
  const collarTrim = new THREE.Mesh(collarTrimGeo, lapisMaterial);
  collarTrim.rotation.x = Math.PI / 2;
  collarTrim.position.set(0, 1.45, 0);
  root.add(collarTrim);

  // 4. BRACCIA PROTESE & DITA MUMMIFICATE ARTIGLIATE
  const armGeo = getSharedGeo('mummy_v2_arm', () => new THREE.CylinderGeometry(0.085, 0.075, 0.58, 8));

  // Braccio sinistro proteso in avanti
  const armLeft = new THREE.Mesh(armGeo, linenMaterial);
  armLeft.position.set(-0.35, 1.28, -0.24);
  armLeft.rotation.x = Math.PI / 2.2;
  armLeft.rotation.z = 0.12;
  armLeft.castShadow = true;
  root.add(armLeft);

  // Braccio destro proteso con angolo asimmetrico
  const armRight = new THREE.Mesh(armGeo, linenMaterial);
  armRight.position.set(0.35, 1.28, -0.22);
  armRight.rotation.x = Math.PI / 2.35;
  armRight.rotation.z = -0.16;
  armRight.castShadow = true;
  root.add(armRight);

  // Mani e dita nere mummificate scoperte
  const handGeo = getSharedGeo('mummy_v2_hand', () => new THREE.BoxGeometry(0.09, 0.06, 0.16));
  const handL = new THREE.Mesh(handGeo, linenDarkMaterial);
  handL.position.set(-0.35, 1.28, -0.56);
  root.add(handL);

  const handR = new THREE.Mesh(handGeo, linenDarkMaterial);
  handR.position.set(0.35, 1.28, -0.54);
  root.add(handR);

  // Lembi di bende cadenti dalle braccia (hanging strips)
  const hangingStripGeo = getSharedGeo('mummy_v2_hanging', () => new THREE.BoxGeometry(0.04, 0.35, 0.015));
  const stripL = new THREE.Mesh(hangingStripGeo, linenMaterial);
  stripL.position.set(-0.34, 1.08, -0.28);
  stripL.rotation.z = 0.1;
  root.add(stripL);

  const stripR = new THREE.Mesh(hangingStripGeo, linenMaterial);
  stripR.position.set(0.34, 1.08, -0.26);
  stripR.rotation.z = -0.08;
  root.add(stripR);

  // 5. TESTA FARAONICA, MASCHERA NEMES, UREO & OCCHI ARDENTI
  const headGeo = getSharedGeo('mummy_v2_head', () => new THREE.BoxGeometry(0.24, 0.28, 0.24));
  const head = new THREE.Mesh(headGeo, linenMaterial);
  head.position.set(0, 1.63, 0);
  head.castShadow = true;
  root.add(head);

  // Copricapo Nemes
  const nemesCrownGeo = getSharedGeo('mummy_v2_nemes', () => new THREE.BoxGeometry(0.31, 0.15, 0.28));
  const nemes = new THREE.Mesh(nemesCrownGeo, goldTrimMaterial);
  nemes.position.set(0, 1.75, -0.02);
  root.add(nemes);

  // Ali laterali del Nemes a strisce blu lapislazzuli
  const flapGeo = getSharedGeo('mummy_v2_flap', () => new THREE.BoxGeometry(0.065, 0.34, 0.19));
  const flapL = new THREE.Mesh(flapGeo, lapisMaterial);
  flapL.position.set(-0.165, 1.52, -0.02);
  root.add(flapL);

  const flapR = new THREE.Mesh(flapGeo, lapisMaterial);
  flapR.position.set(0.165, 1.52, -0.02);
  root.add(flapR);

  // UREO REALE (Cobra d'oro eretto sulla fronte del faraone)
  const uraeusGeo = getSharedGeo('mummy_v2_uraeus', () => new THREE.CylinderGeometry(0.02, 0.035, 0.14, 6));
  const uraeus = new THREE.Mesh(uraeusGeo, goldTrimMaterial);
  uraeus.position.set(0, 1.84, -0.15);
  uraeus.rotation.x = -0.35;
  root.add(uraeus);

  // Occhi ardenti nel buio (fenditure ardenti di fuoco Ka)
  const eyeSocketGeo = getSharedGeo('mummy_v2_eye_socket', () => new THREE.BoxGeometry(0.06, 0.04, 0.03));
  const socketL = new THREE.Mesh(eyeSocketGeo, linenDarkMaterial);
  socketL.position.set(-0.065, 1.65, -0.12);
  root.add(socketL);

  const socketR = new THREE.Mesh(eyeSocketGeo, linenDarkMaterial);
  socketR.position.set(0.065, 1.65, -0.12);
  root.add(socketR);

  const eyeFlameGeo = getSharedGeo('mummy_v2_eye_glow', () => new THREE.BoxGeometry(0.035, 0.025, 0.04));
  const eyeL = new THREE.Mesh(eyeFlameGeo, eyeGlowMaterial);
  eyeL.position.set(-0.065, 1.65, -0.135);
  root.add(eyeL);

  const eyeR = new THREE.Mesh(eyeFlameGeo, eyeGlowMaterial);
  eyeR.position.set(0.065, 1.65, -0.135);
  root.add(eyeR);

  // Barba cerimoniale faraonica
  if (isRoyal) {
    const beardGeo = getSharedGeo('mummy_v2_beard', () => new THREE.CylinderGeometry(0.025, 0.045, 0.24, 6));
    const beard = new THREE.Mesh(beardGeo, goldTrimMaterial);
    beard.position.set(0, 1.42, -0.13);
    beard.rotation.x = -0.22;
    root.add(beard);
  }

  return root;
}
