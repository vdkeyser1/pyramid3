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

/**
 * Archetipo del nemico, usato per risolvere il modello 3D.
 *
 * Sono gli stessi identificatori di `ENEMY_ASSETS` in content/assets.ts, che
 * è l'unica fonte di verità per percorso, scala e offset di ogni modello.
 * Il renderer non deve conoscere i path: li chiede al manifest.
 */
export type RendererEnemyKind =
  | 'MUMMY'
  | 'ROYAL_MUMMY'
  | 'COBRA'
  | 'SCARAB'
  | 'SHABTI'
  | 'PRIEST'
  | 'SOBEK_SPAWN'
  | 'ANUBIS_EXECUTIONER'
  | 'WITNESS';

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
  /** Modello da mostrare. Se assente resta la capsula di fallback. */
  readonly kind?: RendererEnemyKind;
}

export interface RendererObjectiveState {
  readonly exitUnlocked: boolean;
  readonly completed: boolean;
}

/**
 * Hook ART-006: il renderer costruisce i mesh e consegna setter di animazione
 * (senza esporre Object3D) così GameApplication può registrarli in TrapSystem.
 */
export interface FloorLayoutTrapHooks {
  readonly onPressurePlateReady?: (
    trapId: string,
    setSpikesY: (spikesGroupY: number) => void,
  ) => void;
  readonly onPendulumReady?: (
    trapId: string,
    setAngleRad: (angleRad: number) => void,
  ) => void;
  readonly onDartReady?: (
    trapId: string,
    setDart: (travel01: number, visible: boolean) => void,
  ) => void;
  readonly onBoulderReady?: (
    trapId: string,
    setOffsetM: (offsetM: number) => void,
  ) => void;
  readonly onLeverReady?: (
    leverId: string,
    setPose: (handleAngleRad: number, sealY: number) => void,
  ) => void;
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

  /**
   * Anima l'accensione al braciere: il braccio china la torcia verso i
   * carboni e risale. Puramente visivo, non altera lo stato del carburante.
   */
  playTorchIgnite?(): void;

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

  /**
   * Seleziona quale arma mostrare in mano: 'fists' | 'khopesh' | 'staff' | 'shovel'.
   * Un id sconosciuto nasconde tutti i viewmodel.
   */
  setActiveWeaponViewmodel?(weaponId: string): void;

  /** C-02: aggancia una sessione WebXR e passa il loop a setAnimationLoop. */
  enableXr?(session: unknown): Promise<boolean>;

  /** C-02: termina la sessione XR e ripristina il loop desktop. */
  disableXr?(): void;

  /**
   * C-02: registra il frame callback (Three.js setAnimationLoop).
   * Su WebGL+XR il callback è guidato dal compositor VR; altrimenti da RAF.
   * Passa null per fermare il loop del renderer.
   */
  setAnimationLoop?(callback: ((timeMs: number) => void) | null): void;

  /** True se una sessione XR è attiva e presenta frame. */
  isXrActive?(): boolean;

  /** Aggiorna i marker dei nemici attivi del vertical slice. */
  setEnemyStates(states: readonly RendererEnemyState[]): void;

  /** Aggiorna il marker del nemico del vertical slice. */
  setEnemyState(state: RendererEnemyState | null): void;

  /** Aggiorna lo stato visuale dell'uscita del vertical slice. */
  setObjectiveState(state: RendererObjectiveState): void;

  /**
   * Aggiorna il layout visuale derivato dal FloorModel.
   * `trapHooks` collega i mesh ART-006 a TrapSystem senza esporre Three.js
   * all'orchestratore: il renderer consegna solo setter di pose.
   */
  setFloorLayout(layout: FloorSceneLayout | null, trapHooks?: FloorLayoutTrapHooks): void;

  /** G-10: applica la palette del piano (muri, pavimento, accenti, buio). */
  applyFloorPalette(palette: { readonly wallHex: number; readonly floorHex: number; readonly accentHex: number; readonly darknessFactor: number }): void;

  /** QC-1: applica il profilo di qualità (shadow size, bloom, pixel ratio). */
  applyQualityProfile(profile: {
    readonly tier: 'low' | 'medium' | 'high';
    readonly resolutionScale: number;
    readonly shadowMapSize: number;
    readonly usePostFx: boolean;
    readonly ssaoEnabled?: boolean;
    readonly bloomStrength?: number;
  }): void;

  /**
   * G-31: limita le stanze visibili al set entro MAX_HOP dal player.
   * `null` = tutte le stanze registrate nel FrustumCuller.
   */
  setStreamedRoomIds?(ids: ReadonlySet<string> | null): void;

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
