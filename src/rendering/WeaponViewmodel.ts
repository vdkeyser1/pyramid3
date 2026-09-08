/**
 * Scopo: viewmodel 3D dell'arma (khopesh egizio) agganciato alla camera
 *        (gap reale "Viewmodel arma 3D"). Geometria procedurale: niente
 *        asset esterni. Animazioni di swing (attacco) e guardia (parata)
 *        con ritorno elastico alla posa di riposo.
 * Ownership: rendering. Creato in ThreeRendererService.init() e aggiunto
 *        alla camera; il tempo è interno (update(deltaMs)) per testabilità.
 * Invarianti:
 *   - il gruppo è un figlio della camera (posizione RELATIVA allo sguardo);
 *   - le animazioni non lanciano mai e convergono alla posa di riposo;
 *   - nessuna dipendenza dal DOM (testabile sotto happy-dom con three).
 * Failure mode: geometria non disponibile ⇒ creazione robusta (try/catch nel
 *        chiamante: il gioco funziona anche senza viewmodel).
 */

import * as THREE from 'three';

export const KHOPESH_SWING_MS = 180;
export const KHOPESH_PARRY_MS = 260;

export interface WeaponViewmodel {
  readonly group: THREE.Group;
  setVisible(visible: boolean): void;
  /** Fendente: rotazione rapida su Z con ritorno elastico. */
  playSwing(): void;
  /** Guardia: alza l'arma davanti al viso (parata). */
  playParry(): void;
  /** Avanza le animazioni (chiamato dal render loop). */
  update(deltaMs: number): void;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Posizione/rotazione di riposo del khopesh in mano (ben visibile in primo piano). */
const REST_POSITION = new THREE.Vector3(0.24, -0.20, -0.42);
const REST_ROTATION = new THREE.Euler(0.25, -0.22, 0.15);

export function createKhopeshViewmodel(): WeaponViewmodel {
  const group = new THREE.Group();
  group.position.copy(REST_POSITION);
  group.rotation.copy(REST_ROTATION);

  // Materiali (bronzo scuro + impugnatura avvolta + rifiniture oro con emissive).
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xc49b5f,
    metalness: 0.92,
    roughness: 0.28,
    emissive: 0x3a2608,
    emissiveIntensity: 0.3,
  });
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1e14,
    metalness: 0.2,
    roughness: 0.85,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4a05a,
    metalness: 0.8,
    roughness: 0.25,
    emissive: 0x3a2a10,
    emissiveIntensity: 0.35,
  });

  // Lama a falce: tubo lungo una curva crescente (khopesh tipico).
  const bladeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0.05),
    new THREE.Vector3(0, 0.02, -0.12),
    new THREE.Vector3(0.005, 0.09, -0.26),
    new THREE.Vector3(0.015, 0.19, -0.3),
    new THREE.Vector3(0.02, 0.29, -0.22),
    new THREE.Vector3(0.02, 0.31, -0.06),
    new THREE.Vector3(0.015, 0.24, 0.06),
  ]);
  const blade = new THREE.Mesh(
    new THREE.TubeGeometry(bladeCurve, 20, 0.022, 8, false),
    bladeMaterial,
  );
  blade.castShadow = false;

  // Filo dorato lungo il dorso della lama (accento emissivo).
  const edgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 0.0, 0.05),
    new THREE.Vector3(0.025, 0.02, -0.12),
    new THREE.Vector3(0.028, 0.09, -0.26),
    new THREE.Vector3(0.033, 0.19, -0.3),
    new THREE.Vector3(0.036, 0.29, -0.22),
    new THREE.Vector3(0.034, 0.31, -0.06),
    new THREE.Vector3(0.028, 0.24, 0.06),
  ]);
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(edgeCurve, 20, 0.005, 6, false),
    trimMaterial,
  );

  // Impugnatura: cilindro inclinato + guardia + pomolo.
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.02, 0.3, 8),
    handleMaterial,
  );
  handle.position.set(0, -0.13, 0.1);
  handle.rotation.x = 0.25;
  handle.rotation.z = 0.12;

  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.012, 8, 14),
    trimMaterial,
  );
  guard.position.set(0, 0.01, 0.06);
  guard.rotation.y = Math.PI / 2;

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 10, 8),
    trimMaterial,
  );
  pommel.position.set(-0.012, -0.28, 0.17);

  group.add(blade, edge, handle, guard, pommel);

  return attachViewmodelBehavior(group, REST_POSITION, REST_ROTATION);
}

/**
 * Aggiunge a un gruppo già costruito il comportamento comune dei viewmodel:
 * clock interno, fendente, parata e ritorno elastico alla posa di riposo.
 *
 * Estratto da createKhopeshViewmodel perché ogni arma ha bisogno delle stesse
 * animazioni con geometria diversa. Prima esisteva solo il khopesh: bastone,
 * pala e pugni non mostravano nulla in mano.
 *
 * @param restPosition - Posa di riposo; ogni arma ha il proprio ingombro.
 */
function attachViewmodelBehavior(
  group: THREE.Group,
  restPosition: THREE.Vector3,
  restRotation: THREE.Euler,
): WeaponViewmodel {
  let clockMs = 0;
  let swingStartMs = Number.NEGATIVE_INFINITY;
  let parryStartMs = Number.NEGATIVE_INFINITY;
  let visible = true;

  return {
    group,

    setVisible(nextVisible: boolean): void {
      visible = nextVisible;
      group.visible = nextVisible;
    },

    playSwing(): void {
      swingStartMs = clockMs;
    },

    playParry(): void {
      parryStartMs = clockMs;
    },

    update(deltaMs: number): void {
      clockMs += deltaMs;

      if (!visible) return;

      const sinceSwing = clockMs - swingStartMs;
      const sinceParry = clockMs - parryStartMs;
      const swinging = sinceSwing >= 0 && sinceSwing < KHOPESH_SWING_MS;
      const parrying = sinceParry >= 0 && sinceParry < KHOPESH_PARRY_MS;

      if (swinging) {
        const t = easeOutCubic(sinceSwing / KHOPESH_SWING_MS);
        group.rotation.z = THREE.MathUtils.lerp(-1.15, 0.5, t);
        group.rotation.x = THREE.MathUtils.lerp(0.1, -0.45, t);
        group.position.x = THREE.MathUtils.lerp(restPosition.x, restPosition.x - 0.08, t);
      } else if (parrying) {
        const t = easeOutBack(sinceParry / KHOPESH_PARRY_MS);
        group.rotation.x = THREE.MathUtils.lerp(restRotation.x, -1.3, t);
        group.rotation.z = THREE.MathUtils.lerp(restRotation.z, 0.0, t);
        group.position.y = THREE.MathUtils.lerp(restPosition.y, restPosition.y + 0.18, t);
      } else {
        // Ritorno elastico alla posa di riposo con idle sway & breathing procedurale
        const tSec = clockMs * 0.001;
        const idleY = Math.sin(tSec * 1.8) * 0.008;
        const idleX = Math.cos(tSec * 0.9) * 0.005;
        const targetPos = new THREE.Vector3(
          restPosition.x + idleX,
          restPosition.y + idleY,
          restPosition.z,
        );
        group.position.lerp(targetPos, 0.25);
        group.rotation.x += (restRotation.x + Math.sin(tSec * 1.8) * 0.02 - group.rotation.x) * 0.25;
        group.rotation.y += (restRotation.y - group.rotation.y) * 0.25;
        group.rotation.z += (restRotation.z + Math.cos(tSec * 0.9) * 0.015 - group.rotation.z) * 0.25;
      }
    },
  };
}

// ── Altre armi ─────────────────────────────────────────────────────────────

/** Legno scuro comune a bastone e pala. */
function woodMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x5C3F26, roughness: 0.88, metalness: 0.0 });
}

/** Bronzo comune alle parti metalliche. */
function bronzeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x7A5228, roughness: 0.42, metalness: 0.78 });
}

/**
 * Bastone di Ra: asta lunga con puntale a disco solare.
 * Tenuto più al centro del khopesh perché è un'arma a due mani.
 */
export function createStaffViewmodel(): WeaponViewmodel {
  const group = new THREE.Group();
  const rest = new THREE.Vector3(0.22, -0.20, -0.44);
  const restRot = new THREE.Euler(0.30, -0.15, 0.28);
  group.position.copy(rest);
  group.rotation.copy(restRot);

  const wood = woodMaterial();
  const bronze = bronzeMaterial();

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.95, 8), wood);
  shaft.position.y = -0.05;
  group.add(shaft);

  // Disco solare di Ra in cima, con due corna laterali.
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.018, 14), bronze);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 0.46;
  group.add(disc);

  const horn = new THREE.TorusGeometry(0.055, 0.010, 6, 12, Math.PI);
  for (const side of [-1, 1]) {
    const h = new THREE.Mesh(horn, bronze);
    h.rotation.set(Math.PI / 2, 0, side > 0 ? 0 : Math.PI);
    h.position.set(side * 0.05, 0.50, 0);
    group.add(h);
  }

  // Ghiere lungo l'asta: danno scala e leggibilità in movimento.
  const ferrule = new THREE.CylinderGeometry(0.026, 0.026, 0.022, 8);
  for (const y of [0.30, 0.02, -0.28]) {
    const f = new THREE.Mesh(ferrule, bronze);
    f.position.y = y;
    group.add(f);
  }

  return attachViewmodelBehavior(group, rest, restRot);
}

/**
 * Pala: impugnatura e lama a spatola in bronzo ed ottone, ben visibile in primo piano.
 */
export function createShovelViewmodel(): WeaponViewmodel {
  const group = new THREE.Group();
  const rest = new THREE.Vector3(0.22, -0.18, -0.40);
  const restRot = new THREE.Euler(0.40, -0.22, 0.35);
  group.position.copy(rest);
  group.rotation.copy(restRot);

  const wood = woodMaterial();
  const bronze = bronzeMaterial();

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.024, 0.72, 8), wood);
  shaft.position.y = 0.06;
  group.add(shaft);

  // Impugnatura a T in cima.
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 6), wood);
  grip.rotation.z = Math.PI / 2;
  grip.position.y = 0.42;
  group.add(grip);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.05, 8), bronze);
  collar.position.y = -0.27;
  group.add(collar);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.016, 0.24), bronze);
  blade.position.set(0, -0.36, 0.02);
  blade.rotation.x = 0.16;
  group.add(blade);

  return attachViewmodelBehavior(group, rest, restRot);
}

/**
 * Mani nude: un pugno chiuso in basso a destra. Serve a non lasciare lo
 * schermo vuoto quando si passa allo slot 1 — senza nulla in mano il
 * giocatore non capisce di aver cambiato arma.
 */
export function createFistsViewmodel(): WeaponViewmodel {
  const group = new THREE.Group();
  const rest = new THREE.Vector3(0.25, -0.20, -0.38);
  const restRot = new THREE.Euler(-0.20, -0.25, 0.10);
  group.position.copy(rest);
  group.rotation.copy(restRot);

  const skin = new THREE.MeshStandardMaterial({
    color: 0x8A5A3B, roughness: 0.75, metalness: 0.0,
  });
  const linen = new THREE.MeshStandardMaterial({
    color: 0xC9B48C, roughness: 0.92, metalness: 0.0,
  });

  // Pugno: una sfera schiacciata basta a leggere come mano chiusa.
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skin);
  fist.scale.set(1.0, 0.85, 1.15);
  group.add(fist);

  // Avambraccio che esce dal bordo dello schermo.
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.30, 8), skin);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.z = 0.17;
  group.add(forearm);

  // Bende di lino sulle nocche: dettaglio egizio, non guantoni da boxe.
  const wrap = new THREE.TorusGeometry(0.072, 0.012, 6, 14);
  for (const z of [-0.02, 0.03]) {
    const w = new THREE.Mesh(wrap, linen);
    w.rotation.y = Math.PI / 2;
    w.position.z = z;
    group.add(w);
  }

  return attachViewmodelBehavior(group, rest, restRot);
}
