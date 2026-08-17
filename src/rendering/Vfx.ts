/**
 * Scopo: effetti visivi procedurali del gioco (G-15) — fiamma della torcia,
 *        scintille, polvere. Nessun asset esterno: tutto geometry + materiali
 *        emissivi animati via update(deltaMs).
 * Ownership: rendering. Consumato da ThreeRendererService.
 * Invarianti:
 *   - update() deve essere chiamato ogni frame con deltaMs;
 *   - le animazioni usano performance.now() (tempo reale, non simulazione);
 *   - visibile/attached sono gestiti dal chiamante.
 */

import * as THREE from 'three';

export interface TorchFlame {
  readonly group: THREE.Group;
  readonly light: THREE.PointLight;
  /** Anima fiamma + luce. `intensity` 0..1 scala la luminosità. */
  update(deltaMs: number, intensity: number): void;
  /** Riduce il flicker (accessibilità reduceTorchFlicker). */
  setFlickerReduced(reduced: boolean): void;
}

const FLICKER_FREQUENCIES = [0.7, 3.1, 11.3];

/**
 * Crea una fiamma di torcia procedurale: cono emissivo + nucleo bianco-oro +
 * luce calda. La geometria è in scala unitaria; il chiamante la posiziona.
 */
export function createTorchFlame(): TorchFlame {
  const group = new THREE.Group();

  // Fiamma esterna (arancio)
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7a1a,
    emissive: 0xff5a00,
    emissiveIntensity: 1.4,
    roughness: 0.5,
    transparent: true,
    opacity: 0.92,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 12, 1, true), flameMaterial);
  flame.position.y = 0.22;
  group.add(flame);

  // Nucleo (bianco-oro)
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8, 1, true), coreMaterial);
  core.position.y = 0.16;
  group.add(core);

  // Luce calda (piccola, complementare alla SpotLight principale)
  const light = new THREE.PointLight(0xff9b3d, 6, 6, 2);
  light.position.y = 0.3;
  group.add(light);

  let reduced = false;

  function update(_deltaMs: number, intensity: number): void {
    const t = performance.now() * 0.001;
    const flickerGain = reduced ? 0.35 : 1.0;
    let flicker = 0;
    for (const freq of FLICKER_FREQUENCIES) {
      flicker += Math.sin(t * freq * Math.PI * 2) * (1 / freq) * 0.5;
    }
    const pulse = 1.0 + flicker * 0.18 * flickerGain;

    flame.scale.setScalar(pulse);
    core.scale.setScalar(1.0 + flicker * 0.3 * flickerGain);
    flameMaterial.emissiveIntensity = 1.2 + flicker * 0.5 * flickerGain;
    coreMaterial.opacity = 0.85 + flicker * 0.12 * flickerGain;
    light.intensity = 5.5 * intensity * (0.9 + flicker * 0.2 * flickerGain);
  }

  return {
    group,
    light,
    update,
    setFlickerReduced(value: boolean): void {
      reduced = value;
    },
  };
}

// ── Trail arma (G-15 V2) ──────────────────────────────────────────────────

export interface WeaponTrail {
  readonly mesh: THREE.Mesh;
  /** Fa partire un arco luminoso dalla posizione del player lungo il forward. */
  slash(position: { readonly x: number; readonly y: number; readonly z: number }, yaw: number): void;
  /** Anima il trail (deltaMs). Ritorna true mentre è visibile. */
  update(deltaMs: number): boolean;
}

const TRAIL_ARC_RADIUS_M = 1.6;
const TRAIL_ARC_HEIGHT_M = 0.9;
const TRAIL_LIFE_MS = 220;

/**
 * Trail a falce per i colpi corpo-a-corpo: un torus parziale (arco) con
 * materiale emissivo che appare brevemente davanti al player e svanisce.
 * Riutilizza un unico mesh — nessuna allocazione a runtime.
 */
export function createWeaponTrail(): WeaponTrail {
  // Arco orizzontale davanti al player (torus di 180°)
  const geometry = new THREE.TorusGeometry(TRAIL_ARC_RADIUS_M, 0.055, 8, 24, Math.PI);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;

  let lifeMs = 0;

  function slash(
    position: { readonly x: number; readonly y: number; readonly z: number },
    yaw: number,
  ): void {
    lifeMs = TRAIL_LIFE_MS;
    mesh.visible = true;
    mesh.position.set(position.x, position.y + TRAIL_ARC_HEIGHT_M, position.z);
    mesh.rotation.set(0, yaw, 0);
    mesh.rotation.x = -Math.PI / 2 + 0.35; // falce inclinata
    material.opacity = 0.85;
  }

  function update(deltaMs: number): boolean {
    if (lifeMs <= 0) {
      if (mesh.visible) {
        mesh.visible = false;
        material.opacity = 0;
      }
      return false;
    }
    lifeMs -= deltaMs;
    material.opacity = Math.max(0, (lifeMs / TRAIL_LIFE_MS) * 0.85);
    return true;
  }

  return { mesh, slash, update };
}

// ── Particelle burst (scintille / polvere) ─────────────────────────────────

export interface ParticleBurst {
  readonly points: THREE.Points;
  /** Fa partire un burst in posizione. `color` esadecimale, `count` 8-64. */
  emit(position: THREE.Vector3, color: number, count?: number, spread?: number): void;
  /** Anima le particelle attive (deltaMs in ms). */
  update(deltaMs: number): void;
  /** True se non ci sono particelle attive. */
  get idle(): boolean;
}

const MAX_PARTICLES = 128;

/**
 * Pool di particelle additive per effetti brevi (scintille dorate, polvere).
 * Riutilizza un unico buffer — nessuna allocazione a runtime.
 */
export function createParticleBurst(): ParticleBurst {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  const lifetimes = new Float32Array(MAX_PARTICLES);
  const maxLifetimes = new Float32Array(MAX_PARTICLES);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const nextSlot = { value: 0 };

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.frustumCulled = false;

  function emit(position: THREE.Vector3, color: number, count = 24, spread = 1.6): void {
    const c = new THREE.Color(color);
    const start = nextSlot.value;
    for (let i = 0; i < count; i++) {
      const slot = (start + i) % MAX_PARTICLES;
      const idx = slot * 3;
      positions[idx] = position.x;
      positions[idx + 1] = position.y + 0.1;
      positions[idx + 2] = position.z;
      const theta = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.4;
      velocities[idx] = Math.cos(theta) * speed * spread;
      velocities[idx + 1] = 0.6 + Math.random() * 1.6;
      velocities[idx + 2] = Math.sin(theta) * speed * spread;
      lifetimes[slot] = 0;
      maxLifetimes[slot] = 0.4 + Math.random() * 0.7;
      colors[idx] = c.r;
      colors[idx + 1] = c.g;
      colors[idx + 2] = c.b;
    }
    nextSlot.value = (start + count) % MAX_PARTICLES;
    points.visible = true;
  }

  function update(deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    let anyAlive = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const lifetime = lifetimes[i] ?? 0;
      const maxLifetime = maxLifetimes[i] ?? 0;
      if (lifetime >= maxLifetime) {
        continue;
      }
      anyAlive = true;
      lifetimes[i] = lifetime + dt;
      const progress = (lifetime + dt) / (maxLifetime || 1);
      if (progress >= 1) {
        continue;
      }
      const idx = i * 3;
      velocities[idx + 1] = (velocities[idx + 1] ?? 0) - 4.2 * dt; // gravità
      positions[idx] = (positions[idx] ?? 0) + (velocities[idx] ?? 0) * dt;
      positions[idx + 1] = (positions[idx + 1] ?? 0) + (velocities[idx + 1] ?? 0) * dt;
      positions[idx + 2] = (positions[idx + 2] ?? 0) + (velocities[idx + 2] ?? 0) * dt;
      const fade = 1 - progress;
      colors[idx] = (colors[idx] ?? 0) * fade;
      colors[idx + 1] = (colors[idx + 1] ?? 0) * fade;
      colors[idx + 2] = (colors[idx + 2] ?? 0) * fade;
    }
    points.visible = anyAlive;
    points.material.opacity = anyAlive ? 0.95 : 0;
  }

  return {
    points,
    emit,
    update,
    get idle(): boolean {
      return !points.visible;
    },
  };
}
