/**
 * ART-005 — Scala di discesa fra i piani.
 *
 * Scopo: rendere la discesa uno spazio percorribile invece di una
 *        transizione istantanea. Prima si interagiva con l'uscita e partiva
 *        una dissolvenza: la piramide cresceva in pianta ma non si scendeva
 *        mai davvero.
 *
 * Ownership: rendering. Costruita da ThreeRendererService all'uscita del
 *        piano; i collider vengono registrati dal chiamante.
 *
 * Invarianti:
 *   - i gradini scendono SOTTO il livello del pavimento (y = 0), in un vano
 *     che non interferisce con la geometria della stanza;
 *   - ogni gradino ha il proprio collider: senza, il giocatore cadrebbe;
 *   - l'alzata resta sotto PLAYER.maxStepM, altrimenti il character
 *     controller non riesce a salirli tornando indietro.
 *
 * Failure mode: nessuno — geometria puramente procedurale.
 */

import * as THREE from 'three';

/** Numero di gradini. */
const STEP_COUNT = 12;
/** Alzata: sotto maxStepM (0,3 m) così i gradini sono risalibili. */
const STEP_RISE_M = 0.24;
/** Pedata. */
const STEP_RUN_M = 0.46;
/** Larghezza della tromba. */
const STAIR_WIDTH_M = 2.6;
/** Spessore della lastra di ogni gradino. */
const STEP_THICKNESS_M = 0.22;

export interface Staircase {
  readonly group: THREE.Group;
  /** Punto in fondo alla scala: dove far scattare il cambio piano. */
  readonly bottom: THREE.Vector3;
  /** Profondità totale raggiunta, in metri (positiva verso il basso). */
  readonly depth: number;
  dispose(): void;
}

/**
 * Costruisce una scala che scende dal livello del pavimento.
 *
 * @param origin    - Punto di partenza in cima, a livello del pavimento.
 * @param directionRad - Direzione di discesa attorno all'asse Y.
 * @param material  - Materiale della pietra (condiviso col resto del piano).
 * @param addCollider - Callback per registrare il collider di ogni gradino.
 */
export function createStaircase(
  origin: { readonly x: number; readonly y: number; readonly z: number },
  directionRad: number,
  material: THREE.Material,
  addCollider: (x: number, y: number, z: number, hx: number, hy: number, hz: number) => void,
): Staircase {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  const dx = Math.sin(directionRad);
  const dz = Math.cos(directionRad);

  const stepGeo = new THREE.BoxGeometry(STAIR_WIDTH_M, STEP_THICKNESS_M, STEP_RUN_M);
  disposables.push(stepGeo);

  for (let i = 0; i < STEP_COUNT; i++) {
    // Ogni gradino avanza di una pedata e scende di un'alzata.
    const along = (i + 0.5) * STEP_RUN_M;
    const x = origin.x + dx * along;
    const z = origin.z + dz * along;
    const y = origin.y - (i + 1) * STEP_RISE_M;

    const step = new THREE.Mesh(stepGeo, material);
    step.position.set(x, y, z);
    step.rotation.y = directionRad;
    step.receiveShadow = true;
    step.castShadow = true;
    group.add(step);

    // Collider per gradino: senza, si cade attraverso la scala.
    addCollider(x, y, z, STAIR_WIDTH_M / 2, STEP_THICKNESS_M / 2, STEP_RUN_M / 2);
  }

  // Pareti laterali del vano: chiudono la tromba e impediscono di uscirne
  // di lato cadendo nel vuoto sotto il piano.
  const totalRun = STEP_COUNT * STEP_RUN_M;
  const totalDrop = STEP_COUNT * STEP_RISE_M;
  const wallGeo = new THREE.BoxGeometry(0.3, totalDrop + 2.4, totalRun);
  disposables.push(wallGeo);

  for (const side of [-1, 1]) {
    const offX = Math.cos(directionRad) * side * (STAIR_WIDTH_M / 2 + 0.15);
    const offZ = -Math.sin(directionRad) * side * (STAIR_WIDTH_M / 2 + 0.15);
    const cx = origin.x + dx * (totalRun / 2) + offX;
    const cz = origin.z + dz * (totalRun / 2) + offZ;
    const cy = origin.y - totalDrop / 2 + 0.6;

    const wall = new THREE.Mesh(wallGeo, material);
    wall.position.set(cx, cy, cz);
    wall.rotation.y = directionRad;
    wall.receiveShadow = true;
    group.add(wall);

    addCollider(cx, cy, cz, 0.15, (totalDrop + 2.4) / 2, totalRun / 2);
  }

  // Pianerottolo in fondo: dà spazio per fermarsi prima della transizione.
  const landingGeo = new THREE.BoxGeometry(STAIR_WIDTH_M, STEP_THICKNESS_M, 2.0);
  disposables.push(landingGeo);
  const landingAlong = totalRun + 1.0;
  const lx = origin.x + dx * landingAlong;
  const lz = origin.z + dz * landingAlong;
  const ly = origin.y - totalDrop;

  const landing = new THREE.Mesh(landingGeo, material);
  landing.position.set(lx, ly, lz);
  landing.rotation.y = directionRad;
  landing.receiveShadow = true;
  group.add(landing);
  addCollider(lx, ly, lz, STAIR_WIDTH_M / 2, STEP_THICKNESS_M / 2, 1.0);

  return {
    group,
    // Il punto di attivazione sta sul pianerottolo, poco sopra la lastra.
    bottom: new THREE.Vector3(lx, ly + 0.9, lz),
    depth: totalDrop,
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
