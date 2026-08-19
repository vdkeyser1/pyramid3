/**
 * Scopo: interfaccia del servizio di rendering, backend-agnostica.
 * Ownership: GameApplication possiede il servizio.
 *
 * Implementazioni: ThreeRendererService (Three.js WebGPU/WebGL2).
 */

import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';

export type RenderBackend = 'webgpu' | 'webgl2';

export interface RendererPresentationSettings {
  readonly fovDeg: number;
  readonly highContrast: boolean;
  readonly colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  readonly assistedLight: boolean;
  readonly reduceTorchFlicker: boolean;
  /** Amplifica il segnale visivo dei telegrafi d'attacco nemici (G-07). */
  readonly amplifiedTelegraphs: boolean;
  /** Attenua le vibrazioni della camera (G-07). */
  readonly reduceCameraShake: boolean;
  /** Disattiva il motion blur se un post-processing lo applicasse (G-07). */
  readonly disableMotionBlur: boolean;
}

export interface RendererEnemyState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly modelScale: number;
  readonly hpRatio: number;
  readonly alive: boolean;
  readonly awakened: boolean;
  readonly hitFlash: boolean;
  readonly telegraphStrength: number;
}

export interface RendererObjectiveState {
  readonly exitUnlocked: boolean;
  readonly completed: boolean;
}

export interface RendererPlacedTorchState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RendererBrazierState {
  readonly brazierId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly lit: boolean;
  readonly refillUsed: boolean;
}

export interface RendererHandle {
  readonly backend: RenderBackend;
  readonly canvas: HTMLCanvasElement;

  /** Inizializza il backend di rendering. */
  init(): Promise<void>;

  /** Renderizza un frame. Chiamato dal loop principale. */
  render(deltaMs: number): void;

  /**
   * Posiziona la camera secondo lo stato calcolato dalla simulazione (Rapier
   * character controller). Il renderer NON calcola più movimento/collisioni:
   * si limita a riflettere la posizione/orientamento autoritativi (G-01).
   */
  setCameraPose(x: number, y: number, z: number, yaw: number, pitch: number): void;

  /** Accende/spegne la luce della torcia. */
  setTorchLit(lit: boolean): void;

  /** Posiziona o rimuove la torcia posata nel mondo. */
  setPlacedTorchState(state: RendererPlacedTorchState | null): void;

  /** Aggiorna i bracieri presenti nel piano corrente. */
  setBrazierStates(states: readonly RendererBrazierState[]): void;

  /** Interagisce con la porta se vicino. Restituisce true se interazione avvenuta. */
  interactDoor(): boolean;

  /** Aggiorna impostazioni visuali applicate a runtime. */
  applyPresentation(settings: RendererPresentationSettings): void;

  /** Applica una vibrazione alla camera (decadente). 0-1 scala di intensità. */
  addCameraShake(intensity: number): void;

  /**
   * Occhio del Ladro: accende/spegne il tell visivo di pericolo sul sito di
   * scavo (emissive rossa pulsante) quando il nodo meta è acquistato.
   */
  setDangerTell(active: boolean): void;

  /** G-15: burst di scintille in posizione (colpo critico, scavo, braciere). */
  emitSparks(position: { readonly x: number; readonly y: number; readonly z: number }, color?: number, count?: number): void;

  /** G-15 V2: trail a falce sul colpo corpo-a-corpo (posizione + yaw). */
  playWeaponTrail(position: { readonly x: number; readonly y: number; readonly z: number }, yaw: number): void;

  /** Viewmodel arma 3D: fendente (attacco). */
  playWeaponSwing(): void;

  /** Viewmodel arma 3D: guardia alzata (parata). */
  playWeaponParry(): void;

  /** Viewmodel arma 3D: mostra/nascondi (cambio arma). */
  setWeaponViewmodelVisible(visible: boolean): void;

  /** C-02: aggancia una sessione WebXR al renderer (probe sperimentale). */
  enableXr?(session: unknown): void;

  /** Aggiorna i marker dei nemici attivi del vertical slice. */
  setEnemyStates(states: readonly RendererEnemyState[]): void;

  /** Aggiorna il marker del nemico del vertical slice. */
  setEnemyState(state: RendererEnemyState | null): void;

  /** Aggiorna lo stato visuale dell'uscita del vertical slice. */
  setObjectiveState(state: RendererObjectiveState): void;

  /** Aggiorna il layout visuale derivato dal FloorModel. */
  setFloorLayout(layout: FloorSceneLayout | null): void;

  /** G-10: applica la palette del piano (muri, pavimento, accenti, buio). */
  applyFloorPalette(palette: { readonly wallHex: number; readonly floorHex: number; readonly accentHex: number; readonly darknessFactor: number }): void;

  /** QC-1: applica il profilo di qualità (shadow size, bloom, pixel ratio). */
  applyQualityProfile(profile: {
    readonly tier: 'low' | 'medium' | 'high';
    readonly resolutionScale: number;
    readonly shadowMapSize: number;
    readonly usePostFx: boolean;
  }): void;

  /** G-05: mostra/nasconde il reliquiario del tesoro dissotterrato (loot fisico). */
  setLootReliquary(position: { readonly x: number; readonly y: number; readonly z: number } | null): void;

  /** Pala: mostra/nasconde il pickup della pala a terra. null = rimossa. */
  setShovelPickup(position: { readonly x: number; readonly z: number } | null): void;

  /** Debug overlay (v2): draw calls, triangoli, memoria GPU del frame corrente. */
  getDebugStats(): { readonly drawCalls: number; readonly triangles: number; readonly memoryMB: number };

  /** W-7: imposta l'intensità dell'effetto sandstorm (0 = off, 1 = piena). Solo WebGL2. */
  setSandStormIntensity?(value: number): void;

  /** Ridimensiona il canvas. */
  resize(width: number, height: number, pixelRatio: number): void;

  /** Rilascia tutte le risorse GPU. */
  dispose(): void;
}

export interface RendererService {
  create(backend: RenderBackend, canvas: HTMLCanvasElement): Promise<RendererHandle>;
}
