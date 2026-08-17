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

/** Posizione/rotazione di riposo del khopesh in mano. */
const REST_POSITION = new THREE.Vector3(0.38, -0.36, -0.62);
const REST_ROTATION = new THREE.Euler(0.12, -0.15, 0.06);

export function createKhopeshViewmodel(): WeaponViewmodel {
  const group = new THREE.Group();
  group.position.copy(REST_POSITION);
  group.rotation.copy(REST_ROTATION);

  // Materiali (bronzo scuro + impugnatura avvolta + rifiniture oro).
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a7b4f,
    metalness: 0.9,
    roughness: 0.32,
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

  // ── Animazioni (tempo interno) ──
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
        group.position.x = THREE.MathUtils.lerp(0.38, 0.3, t);
      } else if (parrying) {
        const t = easeOutBack(sinceParry / KHOPESH_PARRY_MS);
        group.rotation.x = THREE.MathUtils.lerp(0.12, -1.3, t);
        group.rotation.z = THREE.MathUtils.lerp(0.06, 0.0, t);
        group.position.y = THREE.MathUtils.lerp(-0.36, -0.18, t);
      } else {
        // Ritorno elastico alla posa di riposo.
        group.position.lerp(REST_POSITION, 0.25);
        group.rotation.x += (REST_ROTATION.x - group.rotation.x) * 0.25;
        group.rotation.y += (REST_ROTATION.y - group.rotation.y) * 0.25;
        group.rotation.z += (REST_ROTATION.z - group.rotation.z) * 0.25;
      }
    },
  };
}
