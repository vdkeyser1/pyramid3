/**
 * ART-006 — Geometrie procedurali per trappole e meccanismo leva.
 *
 * Scopo: costruire i mesh Three.js per piastre a pressione, pendoli a lama
 *   e il sigillo di pietra del meccanismo leva, senza dipendere da GLB.
 * Ownership: rendering. Consumato da ThreeDungeonLayout.
 * Invarianti:
 *   - origine a y=0 per tutti gli assembly (il chiamante posiziona in scena);
 *   - i materiali sono passati dall'esterno: la palette del piano resta coerente;
 *   - le parti animabili sono restituite separate dal corpus statico, così
 *     TrapSystem può muoverle per frame senza toccare il resto;
 *   - castShadow/receiveShadow coerenti con il resto del dungeon.
 * Failure mode: geometria procedurale — non può fallire a runtime.
 */

import * as THREE from 'three';
import { TRAPS } from '@/content/balance.js';

// ---------------------------------------------------------------------------
// Piastra a pressione
// ---------------------------------------------------------------------------

/**
 * Piastra a pressione con punte a ritenuta.
 *
 * La piastra è una lastra sottile a livello pavimento, leggermente incassata
 * per suggerire che qualcosa si nasconde sotto. Le punte partono sotto il
 * pavimento (y-locale = –0,33) e vengono animate verso l'alto da TrapSystem
 * impostando spikesGroup.position.y da 0 a TRAPS.pressurePlate.spikeHeightM.
 *
 * Anatomia dell'assembly (tutte le y sono relative all'origine del gruppo):
 *   plate.y        = 0.025   → lastra visibile sul pavimento
 *   spikesGroup.y  = 0       → poi animato da TrapSystem
 *     ogni spike.y = –0.33   → punta a –0.33 + spikeHeightM/2 ≈ sotto il pavimento
 */
export function buildPressurePlateMesh(material: THREE.Material): {
  plate: THREE.Mesh;
  spikesGroup: THREE.Group;
} {
  // Lastra: leggermente rientrante rispetto al pavimento per lettura visiva.
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), material);
  plate.position.y = 0.025;
  plate.castShadow = false;
  plate.receiveShadow = true;

  // Griglia 3×3 di punte — tutte figlie del gruppo animabile.
  const spikesGroup = new THREE.Group();
  const spikeH = 0.55;
  // A riposo il gruppo è a y=0; le punte escono dal pavimento con y_locale = –0.33
  // così la loro punta è a –0.33 + spikeH/2 = –0.055 (appena sotto il pavimento).
  // Quando TrapSystem pone spikesGroup.position.y = spikeHeightM (0.58), la
  // punta sale a –0.055 + 0.58 = 0.525 m sopra il pavimento.
  const spikeLocalY = -(spikeH / 2 + 0.055);

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.058, spikeH, 5), material);
      spike.position.set(i * 0.32, spikeLocalY, j * 0.32);
      spike.castShadow = true;
      spikesGroup.add(spike);
    }
  }

  return { plate, spikesGroup };
}

// ---------------------------------------------------------------------------
// Pendolo a lama
// ---------------------------------------------------------------------------

/**
 * Pendolo a lama da soffitto.
 *
 * Il perno di rotazione (pivot) è posizionato all'altezza mountHeightM.
 * Il braccio si estende verso il basso; in fondo c'è la lama orizzontale.
 * TrapSystem anima la rotazione del pivot:
 *   corridor.axis === 'x' → pivotGroup.rotation.z = angle  (oscilla su Z)
 *   corridor.axis === 'z' → pivotGroup.rotation.x = angle  (oscilla su X)
 *
 * La geometria è posizionata a x=0, z=0; il chiamante posiziona il gruppo
 * in scena con position.set(trap.x, 0, trap.z).
 */
export function buildBladePendulumMesh(material: THREE.Material): {
  pivotGroup: THREE.Group;
  mountMesh: THREE.Mesh;
} {
  const def = TRAPS.bladePendulum;

  // Supporto di montaggio al soffitto (statico).
  const mountMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), material);
  mountMesh.position.y = def.mountHeightM + 0.11;
  mountMesh.castShadow = true;
  mountMesh.receiveShadow = true;

  // Perno di rotazione — l'intero sotto-assembly ruota attorno a questo.
  const pivotGroup = new THREE.Group();
  pivotGroup.position.y = def.mountHeightM;

  // Braccio del pendolo: si estende dal perno verso il basso.
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, def.armLengthM, 0.08), material);
  // Il centro del braccio è a metà lunghezza sotto il perno.
  arm.position.y = -def.armLengthM / 2;
  arm.castShadow = true;
  pivotGroup.add(arm);

  // Lama: piatta, larga quanto indicato in balance.ts, in acciaio opaco.
  // La lama è in fondo al braccio.
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a9a9a,
    metalness: 0.88,
    roughness: 0.18,
  });
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(def.bladeWidthM, 0.06, 0.20),
    bladeMaterial,
  );
  blade.position.y = -def.armLengthM;
  blade.castShadow = true;
  pivotGroup.add(blade);

  return { pivotGroup, mountMesh };
}

// ---------------------------------------------------------------------------
// GAME-ART-012: lanciatore di dardi
// ---------------------------------------------------------------------------

/**
 * Nicchia a muro con dardo animabile lungo l'asse di fuoco.
 * dartMesh.position.{x|z} viene spostato dal renderer in base a travel01 * rangeM.
 */
export function buildDartLauncherMesh(material: THREE.Material): {
  housing: THREE.Mesh;
  dartMesh: THREE.Mesh;
} {
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), material);
  housing.position.y = 1.15;
  housing.castShadow = true;
  housing.receiveShadow = true;

  const dartMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.02, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0xc4a574, metalness: 0.35, roughness: 0.45 }),
  );
  dartMesh.rotation.z = Math.PI / 2;
  dartMesh.position.set(0.2, 1.15, 0);
  dartMesh.castShadow = true;
  dartMesh.visible = false;

  return { housing, dartMesh };
}

// ---------------------------------------------------------------------------
// GAME-ART-012: masso rotolante
// ---------------------------------------------------------------------------

/**
 * Sfera di pietra sul pavimento. Il renderer sposta boulderMesh lungo l'asse
 * del corridoio secondo l'offset restituito da TrapSystem.
 */
export function buildRollingBoulderMesh(material: THREE.Material): {
  boulderMesh: THREE.Mesh;
} {
  const boulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), material);
  boulderMesh.position.y = 0.72;
  boulderMesh.castShadow = true;
  boulderMesh.receiveShadow = true;
  return { boulderMesh };
}

// ---------------------------------------------------------------------------
// Leva a muro
// ---------------------------------------------------------------------------

/**
 * Leva a muro con base e manico ruotante.
 *
 * Il leverGroup va posizionato in scena dal chiamante.
 * TrapSystem anima handle.rotation.z (valore in radianti):
 *   0        → leva a riposo (inclinata indietro, –0.35 rad)
 *   +π/2     → leva tirata (inclinata in avanti)
 * La base rimane sempre ferma.
 *
 * La rotazione è applicata direttamente a handleMesh dall'esterno; per questo
 * handleMesh è restituito separato dal leverGroup (anche se ne è figlio, così
 * il chiamante ha il riferimento diretto senza fare .children[1]).
 */
export function buildLeverMesh(material: THREE.Material): {
  leverGroup: THREE.Group;
  handleMesh: THREE.Mesh;
} {
  const leverGroup = new THREE.Group();

  // Base a muro: blocchetto di pietra che regge il perno.
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.22), material);
  base.position.y = 0.8;
  base.castShadow = true;
  base.receiveShadow = true;
  leverGroup.add(base);

  // Perno: cilindro piccolo che suggerisce l'articolazione.
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), material);
  pivot.rotation.z = Math.PI / 2;
  pivot.position.y = 1.05;
  leverGroup.add(pivot);

  // Manico: il pezzo che ruota quando il giocatore interagisce.
  // La rotazione è attorno all'asse Z (il manico cade in avanti).
  // Posizione iniziale: leggermente inclinato all'indietro.
  const handleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.58, 0.10), material);
  handleMesh.position.y = 1.32;
  handleMesh.rotation.z = -0.35; // Posizione "a riposo"
  handleMesh.castShadow = true;
  leverGroup.add(handleMesh);

  // Impugnatura: sfera in cima al manico.
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), material);
  // La sfera è all'estremità superiore del manico (prima della rotazione).
  grip.position.y = 0.29; // relativo a handleMesh
  handleMesh.add(grip);

  return { leverGroup, handleMesh };
}

// ---------------------------------------------------------------------------
// Sigillo di pietra (slab)
// ---------------------------------------------------------------------------

/**
 * Lastra di pietra che ostruisce una nicchia — il "sigillo" del meccanismo.
 *
 * Geometria: un Box con la larghezza e profondità indicate dalla derivazione
 * e l'altezza pari a TRAPS.lever.sealDropM (così scende esattamente di
 * quella quantità e scompare sotto il pavimento).
 *
 * Il chiamante posiziona il sealMesh con:
 *   position.set(sealPosition.x, sealPosition.y, sealPosition.z)
 * dove sealPosition.y = sealDropM / 2 (il centro della lastra quando chiusa).
 *
 * TrapSystem anima sealMesh.position.y da sealDropM/2 a –sealDropM/2
 * (completamente sottoterra) usando la formula:
 *   sealY = (sealDropM / 2) * (1 – 2 * sealDropProgress)
 */
export function buildSealMesh(
  material: THREE.Material,
  widthM: number,
  depthM: number,
): THREE.Mesh {
  const sealH = TRAPS.lever.sealDropM;
  const seal = new THREE.Mesh(new THREE.BoxGeometry(widthM, sealH, depthM), material);
  // Il centro della lastra è già a sealH/2: il chiamante posiziona con
  // sealPosition.y = sealH/2, che è la posizione "chiusa" corretta.
  seal.castShadow = true;
  seal.receiveShadow = true;
  return seal;
}
