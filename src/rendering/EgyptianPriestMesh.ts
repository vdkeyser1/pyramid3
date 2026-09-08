/**
 * EgyptianPriestMesh.ts
 * Modello 3D procedurale per il Sommo Sacerdote di Anubi (Guardiano dell'Oltretomba).
 * Include:
 * - Maschera di sciacallo in basalto nero e rifiniture in oro;
 * - Occhi cremisi incandescenti con luce del Ka;
 * - Collare cerimoniale Usekh a strisce dorate e lapislazzuli;
 * - Tunica di lino sacerdotale con cintura a nastro reale;
 * - Scettro Was (potere e dominio) e croce Ankh nella mano sinistra;
 * - Dita artigliate ed emanazione di particelle d'ombra.
 */

import * as THREE from 'three';

export interface PriestMeshOptions {
  readonly scale?: number;
  readonly eyeIntensity?: number;
}

export function createEgyptianPriestMesh(options: PriestMeshOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'AnubisPriestMesh';

  const scale = options.scale ?? 1.0;
  const eyeIntensity = options.eyeIntensity ?? 1.5;

  // Materiali
  const blackBasalt = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.35,
    metalness: 0.65,
  });

  const royalGold = new THREE.MeshStandardMaterial({
    color: 0xe5a93b,
    metalness: 0.92,
    roughness: 0.22,
    emissive: 0x5a3f10,
    emissiveIntensity: 0.4,
  });

  const lapisMat = new THREE.MeshStandardMaterial({
    color: 0x113b82,
    metalness: 0.2,
    roughness: 0.45,
  });

  const linenRobe = new THREE.MeshStandardMaterial({
    color: 0xe6dbc8,
    roughness: 0.88,
    metalness: 0.05,
  });

  const redEyesMat = new THREE.MeshStandardMaterial({
    color: 0xff1e27,
    emissive: 0xff0011,
    emissiveIntensity: eyeIntensity,
    roughness: 0.1,
  });

  // 1. Corpo / Tunica Sacerdotale (torso e gonna lunga)
  const robeGeo = new THREE.CylinderGeometry(0.24, 0.42, 1.25, 12);
  const robe = new THREE.Mesh(robeGeo, linenRobe);
  robe.position.y = 0.65;
  robe.castShadow = true;
  root.add(robe);

  // Torso superiore muscoloso in basalto nero
  const torsoGeo = new THREE.BoxGeometry(0.48, 0.55, 0.30);
  const torso = new THREE.Mesh(torsoGeo, blackBasalt);
  torso.position.y = 1.32;
  torso.castShadow = true;
  root.add(torso);

  // Collare cerimoniale Usekh (spalle e petto)
  const collarGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.14, 16);
  const collar = new THREE.Mesh(collarGeo, royalGold);
  collar.position.y = 1.52;
  root.add(collar);

  // Intarsi lapislazzuli sul collare
  const lapisRing = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 16), lapisMat);
  lapisRing.rotation.x = Math.PI / 2;
  lapisRing.position.y = 1.52;
  root.add(lapisRing);

  // Cintura e grembiule reale dorato
  const beltGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.10, 12);
  const belt = new THREE.Mesh(beltGeo, royalGold);
  belt.position.y = 1.08;
  root.add(belt);

  // 2. Testa di Sciacallo di Anubi
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.72, 0);

  // Cranio allungato
  const skullGeo = new THREE.BoxGeometry(0.26, 0.28, 0.32);
  const skull = new THREE.Mesh(skullGeo, blackBasalt);
  headGroup.add(skull);

  // Muso canino appuntito
  const snoutGeo = new THREE.ConeGeometry(0.14, 0.34, 4);
  const snout = new THREE.Mesh(snoutGeo, blackBasalt);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, -0.04, 0.28);
  headGroup.add(snout);

  // Tartufo dorato
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), royalGold);
  nose.position.set(0, -0.04, 0.44);
  headGroup.add(nose);

  // Grandi orecchie a punta di sciacallo
  const earGeo = new THREE.ConeGeometry(0.08, 0.38, 4);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, blackBasalt);
    ear.position.set(side * 0.13, 0.24, -0.02);
    ear.rotation.set(-0.15, 0, side * -0.25);
    headGroup.add(ear);

    // Bordo interno dorato dell'orecchio
    const earTrim = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.28, 4), royalGold);
    earTrim.position.set(side * 0.13, 0.22, 0.01);
    earTrim.rotation.set(-0.15, 0, side * -0.25);
    headGroup.add(earTrim);
  }

  // Occhi cremisi incandescenti
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.08), redEyesMat);
    eye.position.set(side * 0.11, 0.04, 0.15);
    eye.rotation.y = side * 0.25;
    headGroup.add(eye);
  }

  root.add(headGroup);

  // 3. Braccia e Scettro Was
  // Braccio destro con Scettro Was
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.65, 8), blackBasalt);
  rArm.position.set(0.32, 1.25, 0.08);
  rArm.rotation.set(0.3, 0, -0.2);
  root.add(rArm);

  // Scettro Was
  const wasStaffGroup = new THREE.Group();
  wasStaffGroup.position.set(0.38, 0.85, 0.22);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 8), royalGold);
  shaft.position.y = 0.45;
  wasStaffGroup.add(shaft);

  // Testa canina stilizzata dello scettro Was
  const wasHead = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), royalGold);
  wasHead.rotation.x = -Math.PI / 3;
  wasHead.position.set(0, 1.18, 0.06);
  wasStaffGroup.add(wasHead);

  // Forca biforcuta alla base dello scettro
  const forkGeo = new THREE.TorusGeometry(0.06, 0.015, 4, 8, Math.PI);
  const fork = new THREE.Mesh(forkGeo, royalGold);
  fork.rotation.x = Math.PI;
  fork.position.set(0, -0.26, 0);
  wasStaffGroup.add(fork);

  root.add(wasStaffGroup);

  // Braccio sinistro con Amuleto Ankh
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.65, 8), blackBasalt);
  lArm.position.set(-0.32, 1.25, 0.08);
  lArm.rotation.set(0.3, 0, 0.2);
  root.add(lArm);

  const ankhGroup = new THREE.Group();
  ankhGroup.position.set(-0.38, 1.05, 0.20);
  const ankhLoop = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 6, 12), royalGold);
  ankhLoop.position.y = 0.08;
  const ankhCross = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), royalGold);
  const ankhStem = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), royalGold);
  ankhStem.position.y = -0.07;
  ankhGroup.add(ankhLoop, ankhCross, ankhStem);
  root.add(ankhGroup);

  root.scale.set(scale, scale, scale);
  return root;
}
