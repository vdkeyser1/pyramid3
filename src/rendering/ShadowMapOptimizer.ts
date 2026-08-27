/**
 * R-06 — Shadow Map Optimizer
 * Aggiorna la shadow map della SpotLight (torcia) solo quando il giocatore
 * si sposta oltre una soglia, riducendo il costo GPU.
 *
 * Strategia:
 *   - Shadow map: 256×256 (ridotto da 512/1024 del profilo medium/high).
 *   - Update condizionato al movimento > MOVE_THRESHOLD m.
 *   - Fallback: forza refresh ogni MAX_STALE_FRAMES se il giocatore è fermo.
 *   - frustum SpotLight: calcolato automaticamente da Three.js (angle + near/far).
 *   - normalBias e bias preconfigurati per ridurre shadow acne.
 */

import * as THREE from 'three';

// ── Costanti ──────────────────────────────────────────────────────────────────

/** Distanza minima di spostamento giocatore per aggiornare la shadow (m). */
const MOVE_THRESHOLD_M = 0.5;

/** Forza refresh ogni N frame (evita shadow stale in ambienti dinamici). */
const MAX_STALE_FRAMES = 90;

// ── Implementazione ───────────────────────────────────────────────────────────

export class ShadowMapOptimizer {
  private readonly lights: THREE.SpotLight[] = [];
  private lastPlayerPos  = new THREE.Vector3(Infinity, Infinity, Infinity);
  private staleFrames    = 0;
  private pendingUpdate  = true; // forza il primo aggiornamento

  /**
   * Registra una SpotLight per l'ottimizzazione shadow.
   * Configura automaticamente shadow map e parametri bias.
   *
   * @param light   Luce da ottimizzare (es. torcia del giocatore).
   * @param mapSize Dimensione shadow map (default 256; usare potenze di 2).
   */
  addSpotLight(light: THREE.SpotLight, mapSize = 256): void {
    light.castShadow = true;
    light.shadow.mapSize.set(mapSize, mapSize);
    // Frustum automatico da Three.js: deriva da light.angle
    // near/far ragionevoli per torcia in dungeon
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far  = 15;
    light.shadow.bias        = -0.001;
    light.shadow.normalBias  = 0.02;
    this.lights.push(light);
  }

  /**
   * Da chiamare ogni frame prima del render.
   * Marca le shadow per aggiornamento solo quando necessario.
   *
   * @param playerPos Posizione attuale del giocatore nel mondo.
   */
  update(playerPos: THREE.Vector3): void {
    const moved = playerPos.distanceTo(this.lastPlayerPos) > MOVE_THRESHOLD_M;

    if (moved || this.staleFrames >= MAX_STALE_FRAMES) {
      this.pendingUpdate = true;
      this.lastPlayerPos.copy(playerPos);
      this.staleFrames = 0;
    } else {
      this.staleFrames++;
    }

    const needsUpdate = this.pendingUpdate;
    this.pendingUpdate = false;

    for (const light of this.lights) {
      if (light.shadow.map) {
        light.shadow.needsUpdate = needsUpdate;
      }
    }
  }

  /**
   * Forza aggiornamento al frame successivo.
   * Da chiamare su cambio stanza, teleport o altra discontinuità di posizione.
   */
  forceUpdate(): void {
    this.pendingUpdate = true;
    this.staleFrames   = MAX_STALE_FRAMES;
  }

  dispose(): void {
    this.lights.length = 0;
  }
}
