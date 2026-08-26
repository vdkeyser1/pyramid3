/**
 * Braccio con la torcia, agganciato alla camera.
 *
 * Scopo: rendere visibile chi porta la luce. Prima esisteva solo la fiamma
 *        (createTorchFlame in Vfx.ts) sospesa nel vuoto davanti alla camera:
 *        si vedeva il fuoco ma non la mano né il bastone che lo regge.
 * Ownership: rendering. Creato in ThreeRendererService.init() e aggiunto
 *        alla camera; il tempo è interno (update(deltaMs)) per testabilità.
 * Invarianti:
 *   - il gruppo è figlio della camera (posizione RELATIVA allo sguardo);
 *   - `flameAnchor` è il punto dove va agganciata la fiamma procedurale;
 *   - le animazioni convergono sempre alla posa di riposo, non lanciano mai.
 * Failure mode: nessuno — geometria puramente procedurale.
 */

import * as THREE from 'three';

/** Durata dell'abbassamento verso il braciere per accendere. */
export const TORCH_IGNITE_MS = 900;

export interface TorchViewmodel {
  readonly group: THREE.Group;
  /** Punto in cima alla torcia dove agganciare la fiamma. */
  readonly flameAnchor: THREE.Object3D;
  setVisible(visible: boolean): void;
  /**
   * Accensione: il braccio china la torcia in avanti e in basso, come per
   * appoggiarla ai carboni del braciere, poi risale.
   */
  playIgnite(): void;
  update(deltaMs: number): void;
  dispose(): void;
}

/** Posa di riposo: torcia alzata a sinistra, fuori dal centro dello schermo. */
const REST_POSITION = new THREE.Vector3(-0.40, -0.30, -0.60);
const REST_ROTATION = new THREE.Euler(0.10, 0.22, -0.18);

/** Posa di accensione: torcia protesa in avanti e abbassata verso i carboni. */
const IGNITE_POSITION = new THREE.Vector3(-0.16, -0.46, -0.86);
const IGNITE_ROTATION = new THREE.Euler(-0.62, 0.10, -0.05);

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function createTorchViewmodel(): TorchViewmodel {
  const group = new THREE.Group();
  group.position.copy(REST_POSITION);
  group.rotation.copy(REST_ROTATION);

  const disposables: { dispose(): void }[] = [];

  const skin = new THREE.MeshStandardMaterial({
    color: 0x8A5A3B, roughness: 0.75, metalness: 0.0,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: 0x4A3320, roughness: 0.90, metalness: 0.0,
  });
  const linen = new THREE.MeshStandardMaterial({
    color: 0xB8A176, roughness: 0.95, metalness: 0.0,
  });
  const pitch = new THREE.MeshStandardMaterial({
    // Pece annerita dalla combustione: la testa della torcia non è legno nudo.
    color: 0x241A12, roughness: 0.98, metalness: 0.0,
  });
  disposables.push(skin, wood, linen, pitch);

  // ── Avambraccio che entra dal bordo dello schermo ───────────────────────
  const forearmGeo = new THREE.CylinderGeometry(0.055, 0.070, 0.34, 8);
  disposables.push(forearmGeo);
  const forearm = new THREE.Mesh(forearmGeo, skin);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.set(0, -0.10, 0.20);
  group.add(forearm);

  // ── Pugno chiuso attorno al bastone ─────────────────────────────────────
  const fistGeo = new THREE.SphereGeometry(0.072, 10, 8);
  disposables.push(fistGeo);
  const fist = new THREE.Mesh(fistGeo, skin);
  fist.scale.set(1.0, 0.90, 1.10);
  fist.position.set(0, -0.06, 0.03);
  group.add(fist);

  // ── Bastone della torcia ────────────────────────────────────────────────
  const shaftGeo = new THREE.CylinderGeometry(0.026, 0.030, 0.52, 8);
  disposables.push(shaftGeo);
  const shaft = new THREE.Mesh(shaftGeo, wood);
  shaft.position.set(0, 0.10, 0);
  group.add(shaft);

  // ── Legature di lino lungo il bastone ───────────────────────────────────
  const wrapGeo = new THREE.TorusGeometry(0.033, 0.010, 6, 12);
  disposables.push(wrapGeo);
  for (const y of [-0.02, 0.06]) {
    const wrap = new THREE.Mesh(wrapGeo, linen);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = y;
    group.add(wrap);
  }

  // ── Testa impregnata di pece ────────────────────────────────────────────
  const headGeo = new THREE.CylinderGeometry(0.062, 0.038, 0.16, 10);
  disposables.push(headGeo);
  const head = new THREE.Mesh(headGeo, pitch);
  head.position.y = 0.40;
  group.add(head);

  // ── Ancora della fiamma: sopra la testa della torcia ────────────────────
  // È un Object3D vuoto: la fiamma procedurale ci viene agganciata dal
  // renderer, così segue il braccio anche durante l'accensione.
  const flameAnchor = new THREE.Object3D();
  flameAnchor.position.y = 0.47;
  group.add(flameAnchor);

  // ── Animazione ──────────────────────────────────────────────────────────
  let clockMs = 0;
  let igniteStartMs = Number.NEGATIVE_INFINITY;
  let visible = true;

  return {
    group,
    flameAnchor,

    setVisible(next: boolean): void {
      visible = next;
      group.visible = next;
    },

    playIgnite(): void {
      igniteStartMs = clockMs;
    },

    update(deltaMs: number): void {
      clockMs += deltaMs;
      if (!visible) return;

      const since = clockMs - igniteStartMs;
      if (since >= 0 && since < TORCH_IGNITE_MS) {
        // Andata e ritorno: 0 → 1 → 0 nella durata dell'accensione.
        const raw = since / TORCH_IGNITE_MS;
        const t = easeInOutSine(raw < 0.5 ? raw * 2 : (1 - raw) * 2);
        group.position.lerpVectors(REST_POSITION, IGNITE_POSITION, t);
        group.rotation.x = THREE.MathUtils.lerp(REST_ROTATION.x, IGNITE_ROTATION.x, t);
        group.rotation.y = THREE.MathUtils.lerp(REST_ROTATION.y, IGNITE_ROTATION.y, t);
        group.rotation.z = THREE.MathUtils.lerp(REST_ROTATION.z, IGNITE_ROTATION.z, t);
        return;
      }

      // Ritorno elastico con idle sway naturale (fiamma e braccio)
      const tSec = clockMs * 0.001;
      const torchSwayY = Math.sin(tSec * 1.5 + 0.8) * 0.006;
      const torchSwayX = Math.cos(tSec * 1.1 + 0.4) * 0.004;
      const targetPos = new THREE.Vector3(
        REST_POSITION.x + torchSwayX,
        REST_POSITION.y + torchSwayY,
        REST_POSITION.z,
      );
      group.position.lerp(targetPos, 0.18);
      group.rotation.x += (REST_ROTATION.x + Math.sin(tSec * 1.5) * 0.015 - group.rotation.x) * 0.18;
      group.rotation.y += (REST_ROTATION.y - group.rotation.y) * 0.18;
      group.rotation.z += (REST_ROTATION.z + Math.cos(tSec * 1.1) * 0.012 - group.rotation.z) * 0.18;
    },

    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
