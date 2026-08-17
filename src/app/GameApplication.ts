/**
 * Scopo: orchestratore del ciclo di vita dell'applicazione.
 * Ownership: main.ts lo crea e lo distrugge.
 */

import { type GameConfig, DEFAULT_CONFIG, GameConfigSchema } from '@/config/GameConfig.js';
import { detectCapabilities, selectBackend } from '@/config/PerformanceTiers.js';
import { type FixedStepClock, createFixedStepClock } from '@/core/FixedStepClock.js';
import { type Simulation, createSimulation } from '@/simulation/Simulation.js';
import { TICK_HZ, PLAYER, TORCH } from '@/content/balance.js';
import { createLogger, configureLogger, type Logger } from '@/core/Logger.js';
import type {
  RendererBrazierState,
  RendererHandle,
  RendererPlacedTorchState,
} from '@/rendering/RendererService.js';
import type { GenerationClient } from '@/workers/GenerationClient.js';
import { QualityController } from '@/rendering/QualityController.js';
import {
  applyActionBindingOverrides,
  cloneBindings,
  createActionMap,
  ActionKind,
  type ActionMap,
} from '@/input/ActionMap.js';
import { createInputSystem, type InputSystem, type InputFrame } from '@/input/InputSystem.js';
import { createHUD, type HUD, type SubtitleDirection } from '@/ui/HUD.js';
import { createCinematicOverlay } from '@/ui/CinematicOverlay.js';
import { createSettingsMenu, type SettingsMenu, type RuntimeSettings } from '@/ui/SettingsMenu.js';
import {
  createTorch,
  tickTorch,
  type TorchRuntime,
  type TorchStepResult,
} from '@/gameplay/torch/TorchSystem.js';
import type { PhysicsWorld } from '@/physics/PhysicsWorld.js';
import {
  createSaveManager,
  type SaveData,
  type SaveManager,
} from '@/progression/SaveManager.js';
import type {
  PlayerCharacterController,
  PlayerInput,
} from '@/gameplay/player/PlayerCharacterController.js';
import type { InputSource } from '@/simulation/systems/PlayerSystem.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import { getGameRuntimeModules } from '@/app/GameRuntimeModules.js';
import { createPauseReasonTracker, type PauseReason } from '@/app/PauseReasons.js';
import {
  deriveTorchPresentation,
  resolveTorchAction,
  type TorchActionKind,
} from '@/app/TorchActions.js';
import {
  createAccessibilityToggleRuntime,
  isSprintActive,
  syncSprintToggleSetting,
  toggleSprintLatch,
} from '@/app/AccessibilityToggleRuntime.js';
import {
  readSavedRuntimeSettings,
  writeRuntimeSettingsToSave,
} from '@/app/RuntimeSettingsPersistence.js';
import { applyViewportMetrics } from '@/app/ViewportSizing.js';
import {
  emitBrazierEvents,
  emitDigEvents,
  emitTorchEvents,
  type GameplayEventPosition,
} from '@/app/GameplayEventBridge.js';
import {
  applyProgressionEventToSave,
  convertRunGoldToFragments,
  shouldPersistAfterEvent,
} from '@/app/RunProgression.js';
import {
  applyRuntimeGameplayEvent,
  createRuntimeGameplayState,
} from '@/app/RuntimeGameplayState.js';
import {
  applyRuntimeStimulusEvent,
  createRuntimeStimulusState,
  tickRuntimeStimulusState,
} from '@/app/RuntimeStimulusState.js';
import { buildRuntimeMinimap } from '@/app/RuntimeMinimap.js';
import {
  createEnemySpawnDirector,
  type EnemySpawnDirector,
} from '@/simulation/EnemySpawnDirector.js';
import {
  canPurchase,
  getNodeLevel,
  getProgressionState,
  KA_TREE,
  purchaseKaNode,
} from '@/progression/KaProgression.js';
import {
  getRuntimeBonuses,
  remapCurrentValueToNewMaximum,
  type RuntimeBonuses,
} from '@/progression/RuntimeBonuses.js';
import {
  createProgressionOverlay,
  type ProgressionOverlay,
} from '@/ui/ProgressionOverlay.js';
import {
  createDeathOverlay,
  type DeathOverlay,
} from '@/ui/DeathOverlay.js';
import {
  createDebugOverlay,
} from '@/ui/DebugOverlay.js';
import {
  createMainMenu,
  type MainMenu,
} from '@/ui/MainMenu.js';
import { createAudioEngine } from '@/audio/WebAudioEngine.js';
import {
  WEAPON_FISTS,
  WEAPON_KHOPESH,
  WEAPON_STAFF,
} from '@/content/weapons.js';
import { ENEMIES } from '@/content/enemies.js';
import { rollGoldDrop } from '@/content/economy.js';
import { hash32 } from '@/procedural/Hash32.js';
import {
  createCombatState,
  startAttack,
  tickCombatState,
} from '@/gameplay/combat/CombatSystem.js';
import type { AttackDefinition } from '@/gameplay/combat/AttackDefinition.js';
import type { WeaponDefinition } from '@/gameplay/weapons/WeaponDefinition.js';
import { deriveEventFeedback } from '@/app/AudioEventDirector.js';
import {
  createBrazier,
  igniteBrazier,
  refillFromBrazier,
  type BrazierState,
} from '@/gameplay/torch/BrazierSystem.js';
import {
  createDigSite,
  getDigProgress,
  tickDig,
  type DigSite,
} from '@/gameplay/digging/DiggingSystem.js';
import {
  applyDamageToSliceTarget,
  createVerticalSliceState,
  getObjectiveText,
  getTargetHudText,
  getTargetTelegraphStrength,
  markSliceFailed,
  tickVerticalSlice,
  tryCompleteSlice,
  VERTICAL_SLICE_GENERATION_INPUT,
  type VerticalSliceState,
} from '@/gameplay/verticalSlice/VerticalSliceRuntime.js';
import {
  createSliceGuardianEntitySync,
  type SliceGuardianEntitySync,
} from '@/gameplay/verticalSlice/SliceGuardianEntitySync.js';
import type { SliceGuardianRuntime } from '@/gameplay/verticalSlice/SliceGuardianRuntime.js';
import type { DomainEvent } from '@/simulation/DomainEventQueue.js';
import { HurtboxStore } from '@/gameplay/combat/HurtboxStore.js';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';
import { collectAttackHits } from '@/gameplay/combat/AttackHitResolver.js';
import { ALL_UPGRADES } from '@/content/upgrades.js';
import { MAX_FLOORS, floorProgressionFor, floorSeed } from '@/content/floorProgression.js';
import { applyCurseEffects, curseForFloor, type ActiveCurse } from '@/content/curses.js';
import { rollDigLoot } from '@/content/digLoot.js';
import { submitRunScore, shareSeedUrl } from '@/progression/Leaderboard.js';
import {
  resolveCombatModifiers,
  resolvePlayerDamage,
  upgradesFromNames,
  type CombatModifiers,
} from '@/gameplay/upgrades/UpgradeResolver.js';
import { resolveDamage } from '@/gameplay/combat/DamageResolver.js';
import { PARRY_IFRAME_MS, PARRY_WINDOW_MS, parryWindowActive } from '@/gameplay/combat/ParryResolver.js';
import type { MusicState } from '@/audio/MusicPreset.js';
import {
  applyDamageToGenericEnemy,
  createGenericEncounterState,
  getGenericTelegraphStrength,
  isGenericEnemyAlive,
  tickGenericEncounter,
  type GenericEncounterState,
} from '@/gameplay/enemies/GenericEncounterRuntime.js';
import {
  applyDamageToScarab,
  createScarabEncounterState,
  getScarabTelegraphStrength,
  tickScarabEncounter,
  type ScarabEncounterState,
} from '@/gameplay/enemies/ScarabEncounterRuntime.js';
import {
  createMummyEncounterState,
  getMummyTelegraphStrength,
  tickMummyEncounter,
  type MummyEncounterState,
} from '@/gameplay/enemies/MummyEncounterRuntime.js';

export type AppState = 'uninitialized' | 'initializing' | 'running' | 'paused' | 'disposed';

export interface GameApplication {
  readonly config: GameConfig;
  readonly clock: FixedStepClock;
  readonly simulation: Simulation;
  readonly input: InputSystem;
  readonly actionMap: ActionMap;
  readonly hud: HUD;
  readonly settingsMenu: SettingsMenu;
  readonly log: Logger;
  readonly state: AppState;
  init(canvas: HTMLCanvasElement): Promise<void>;
  start(): void;
  pause(reason?: PauseReason): void;
  resume(reason?: PauseReason): void;
  dispose(): void;
}

export function createGameApplication(
  configOverrides?: Partial<GameConfig>,
  onStatus?: (status: string) => void,
): GameApplication {
  const config = GameConfigSchema.parse({ ...DEFAULT_CONFIG, ...configOverrides });
  const caps = detectCapabilities();
  const backend = selectBackend(caps, config.render.backend);
  const quality = new QualityController(config.render.qualityTier);

  configureLogger(config.debug.logLevel);

  const log = createLogger('App');
  const clock = createFixedStepClock(TICK_HZ);
  const simulation = createSimulation(clock);
  let actionMap = createActionMap();
  const input = createInputSystem(actionMap);
  const hud = createHUD();
  // G-15: vignette/grana/respiro del buio (DOM, zero costo GPU).
  const cinematicOverlay = createCinematicOverlay();
  const settingsMenu = createSettingsMenu();
  const progressionOverlay: ProgressionOverlay = createProgressionOverlay();
  const deathOverlay: DeathOverlay = createDeathOverlay();
  // Debug overlay (v2): F3/Backquote — profiling in-game (draw calls, ms, seed).
  const debugOverlay = createDebugOverlay();
  const audio = createAudioEngine();
  const runtimeModules = getGameRuntimeModules();
  const accessibilityToggleRuntime = createAccessibilityToggleRuntime();

  let state: AppState = 'uninitialized';
  let rafId = 0;
  let lastTimeMs = 0;
  let renderer: RendererHandle | null = null;
  let generationClient: GenerationClient | null = null;
  let saveManager: SaveManager | null = null;
  let saveData: SaveData | null = null;
  let frameCount = 0;
  let frameTimeAccum = 0;
  let profilePersistPromise: Promise<void> = Promise.resolve();
  let detachViewportListeners: (() => void) | null = null;
  let detachCanvasClick: (() => void) | null = null;
  let detachPointerLockListeners: (() => void) | null = null;
  let viewportResizeRaf = 0;
  let pendingPointerLockRestore = false;
  let suppressNextPointerLockLoss = false;

  // Torch runtime (sistema carburante)
  let torchRuntime: TorchRuntime = createTorch(TORCH.initialFuelSeconds);
  let torchLit = false;
  let torchPlaced = false;
  let placedTorchPosition: RendererPlacedTorchState | null = null;
  let brazierStates: BrazierState[] = [];
  let digSite: DigSite | null = null;
  let runtimeStimulusState = createRuntimeStimulusState();
  let runtimeBonuses: RuntimeBonuses = {
    torchCapacitySeconds: TORCH.initialFuelSeconds,
    playerMaxHp: PLAYER.baseHealthHp,
    hasAnubiRevive: false,
    startsWithStaff: false,
    guaranteesEarlyMap: false,
    hasDodgeIFrames: false,
    hasLootDangerTell: false,
    canDeposeCurse: false,
  };
  let anubiReviveConsumed = false;
  let deathCause = 'oscura minaccia';

  // Fisica + player controller (G-01)
  let physicsWorld: PhysicsWorld | null = null;
  let guardianRuntime: SliceGuardianRuntime | null = null;
  let guardianEntitySync: SliceGuardianEntitySync | null = null;
  let scarabState: ScarabEncounterState | null = null;
  let mummyState: MummyEncounterState | null = null;
  // G-13: slot generico — qualsiasi archetipo del Director (COBRA, SHABTI,
  // PRIEST, SOBEK_SPAWN, ROYAL_MUMMY) materializzabile via runtime data-driven.
  let genericEnemyState: GenericEncounterState | null = null;
  let enemySpawnDirector: EnemySpawnDirector | null = null;
  const enemyHurtboxes = new HurtboxStore();
  const playerHitRegistry = new HitRegistry();
  let playerController: PlayerCharacterController | null = null;
  let playerEntityId: EntityId | null = null;
  let playerAttackActiveStartTick: number | null = null;
  let playerAttackConnectedThisSwing = false;
  // Mouse-look accumulato una volta per frame di rendering (non per tick fisso)
  let cameraYaw = 0;
  let cameraPitch = 0;
  // G-18 V3: smoothing del mouse-look — velocità angolare filtrata
  // esponenzialmente per una rotazione morbida (niente scatti da delta grezzi).
  let lookYawFiltered = 0;
  let lookPitchFiltered = 0;
  // NEW-1: hitstop — tick di pausa del loop fisico dopo un colpo a segno.
  let hitstopTicksRemaining = 0;
  // Intro cinematografica: la camera panoramica la stanza d'ingresso e mostra
  // la torcia da raccogliere prima di cedere il controllo al player.
  let introCinematicUntilMs = 0;
  let introStarted = false;
  let introTorchPosition: { readonly x: number; readonly y: number; readonly z: number } | null = null;
  const EYE_HEIGHT_OFFSET_M = PLAYER.capsuleHeightM / 2 - 0.15;
  const GUARDIAN_HURTBOX_RADIUS_M = 0.55;
  const GUARDIAN_HURTBOX_HEIGHT_M = 1.8;
  const SCARAB_HURTBOX_RADIUS_M = 0.38;
  const SCARAB_HURTBOX_HEIGHT_M = 0.9;
  const MUMMY_HURTBOX_RADIUS_M = 0.55;
  const MUMMY_HURTBOX_HEIGHT_M = 1.75;

  // Stato del player per l'input → HUD
  let playerMaxHp: number = PLAYER.baseHealthHp;
  let runtimeGameplayState = createRuntimeGameplayState();
  const weapons: readonly WeaponDefinition[] = [WEAPON_FISTS, WEAPON_KHOPESH, WEAPON_STAFF];
  let currentWeaponIndex = 1;
  let weaponName = weapons[currentWeaponIndex]?.name ?? 'Khopesh';
  // G-05: modifier di combattimento derivati dai graft scoperti nel profilo.
  let combatModifiers: CombatModifiers = {
    damageMultiplier: 1,
    attackSpeedMultiplier: 1,
    durabilityMultiplier: 1,
    bonusDamageUndead: 0,
    backCritMultiplier: 1,
    frontDamageMultiplier: 1,
  };
  let tutorialShown = false;
  const pauseReasons = createPauseReasonTracker();
  let mainMenu: MainMenu | null = null;
  let sliceState: VerticalSliceState | null = null;
  // G-10: piano corrente della discesa (1..MAX_FLOORS).
  let currentFloorIndex = 1;
  // NEW-3: maledizione attiva sul piano corrente (Sangue di Ra).
  let activeCurse: ActiveCurse | null = null;
  // G-05: reliquiario del tesoro dissotterrato, in attesa di raccolta (E).
  let pendingLoot: { readonly x: number; readonly z: number; readonly siteId: string } | null = null;
  // Run summary (v2): statistiche della run corrente per la schermata finale.
  // C-01: runId unico per la classifica locale (una run per caricamento pagina).
  let runStats = {
    runId: `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(16)}`,
    floorsCleared: 0,
    enemiesDefeated: 0,
    goldEarned: 0,
  };
  const playerCombatState = createCombatState();
  let guardianHitFlashUntilMs = 0;
  let scarabHitFlashUntilMs = 0;
  let mummyHitFlashUntilMs = 0;
  // G-18: cooldown dei passi sulla sabbia (ms).
  let footstepCooldownMs = 0;
  const BRAZIER_INTERACT_RADIUS_M = 2.35;
  const DIG_SITE_INTERACT_RADIUS_M = 1.85;
  const PLACED_TORCH_PICKUP_RADIUS_M = 2.2;
  // Passo di Bastet: finestra di invulnerabilità durante la schivata (0.12s).
  const DODGE_IFRAME_MS = 120;
  // NEW-1: hitstop — tick di pausa della simulazione dopo un colpo a segno
  // (3-4 tick ≈ 50-67ms: l'impatto si sente senza rompere il flow).
  const HITSTOP_TICKS = 4;
  let dodgeIFramesUntilMs = 0;
  // Parata: finestra di parata (tasto destro) + i-frame residui. La finestra
  // viene aperta alla pressione di Parry e consumata dai runtime nemici al
  // primo tick ACTIVE dei loro attacchi (parryable + arco frontale).
  let parryWindowUntilMs = Number.NEGATIVE_INFINITY;
  let parryIFramesUntilMs = Number.NEGATIVE_INFINITY;
  // G-19: stato corrente della musica adattiva (crossfade al cambio).
  let currentMusicState: MusicState = 'EXPLORE';

  /**
   * G-19: musica adattiva — deriva lo stato dai nemici vivi:
   * COMBAT se un nemico sta ATTACCANDO/caricando, TENSION se qualcuno è
   * sveglio, EXPLORE altrimenti. Chiamato una volta per frame.
   */
  function updateMusicState(): void {
    const scarabCombat = scarabState?.runtime.state === 'CHARGING';
    const mummyCombat = mummyState?.runtime.state === 'ATTACKING';
    const genericCombat = genericEnemyState?.runtime.state === 'ATTACKING';
    const anyCombat = scarabCombat || mummyCombat || genericCombat;
    const anyAwake =
      scarabState?.awakened === true ||
      mummyState?.runtime.state !== 'SLEEPING' ||
      genericEnemyState?.runtime.state !== 'DORMANT';
    const next: MusicState = anyCombat ? 'COMBAT' : anyAwake ? 'TENSION' : 'EXPLORE';
    if (next !== currentMusicState) {
      currentMusicState = next;
      audio.setMusicState(next);
    }
  }

  // Local pause/resume functions (definiti prima di processInput che li usa)
  function localPause(reason: PauseReason = 'manual'): void {
    if (state !== 'running' && state !== 'paused') return;

    const addedReason = pauseReasons.add(reason);
    if (!addedReason || state === 'paused') return;

    const canvasWasPointerLocked = isCanvasPointerLocked();
    pendingPointerLockRestore ||= canvasWasPointerLocked;
    suppressNextPointerLockLoss = canvasWasPointerLocked;
    state = 'paused';
    cancelAnimationFrame(rafId);
    clock.resetAccumulator();
    document.exitPointerLock();
    input.detach();
    void audio.suspend();
    syncPointerLockState();
    log.info('Game loop in pausa', { reason, activeReasons: pauseReasons.activeReasons });
  }

  function localResume(reason: PauseReason = 'manual'): void {
    if (state !== 'paused') return;

    const removedReason = pauseReasons.remove(reason);
    if (!removedReason || pauseReasons.paused) return;

    state = 'running';
    lastTimeMs = 0;
    if (renderer) {
      input.attach(renderer.canvas);
      focusCanvas();
    }
    void audio.resume();
    if (
      reason === 'visibility' &&
      pendingPointerLockRestore &&
      !tutorialShown &&
      !settingsMenu.visible
    ) {
      hud.showMessage('Clicca per riagganciare il mouse', 2200);
    }
    syncPointerLockState();
    rafId = requestAnimationFrame(loop);
    log.info('Game loop ripreso', { reason });
  }

  function resumeFromSettings(): void {
    settingsMenu.hide();
    localResume('manual');
    if (pendingPointerLockRestore && !tutorialShown && !document.hidden) {
      requestCanvasPointerLock();
    }
  }

  function buildProgressionOverlayData() {
    const progressionState = saveData
      ? getProgressionState(saveData)
      : getProgressionState({
        schemaVersion: 1,
        contentVersion: '0.1.0',
        createdAt: '',
        updatedAt: '',
        checksum: '',
        payload: {
          fragments: 0,
          pyramidsUnlocked: 1,
          bestiaryEntries: [],
          discoveredGrafts: [],
          kaNodes: [],
          claimedTreasureSiteIds: [],
          completedFloorIds: [],
          settings: {},
        },
      });
    function describeKaNodeStatus(nodeId: string, level: number): string {
      switch (nodeId) {
        case 'respiro-lungo':
          return level > 0
            ? `Capacita torcia attuale: ${torchRuntime.capacitySeconds}s.`
            : 'Nessun bonus torcia attivo.';
        case 'ka-robusto':
          return level > 0
            ? `HP massimi attuali: ${playerMaxHp}.`
            : `HP massimi base: ${PLAYER.baseHealthHp}.`;
        case 'mano-ferma':
          return level > 0
            ? 'Bastone iniziale sbloccato nelle slot runtime.'
            : 'Il bastone resta bloccato finche il nodo non viene acquistato.';
        case 'memoria-di-thoth':
          return level > 0
            ? 'La stanza mappa viene forzata nella prima meta del piano.'
            : 'Nessuna preferenza di generazione per la stanza mappa.';
        case 'patto-di-anubi':
          return level > 0
            ? 'Una resurrezione al 30% HP per run.'
            : 'Nessuna resurrezione runtime disponibile.';
        case 'occhio-del-ladro':
          return level > 0
            ? 'Tell visivo sui contenitori pericolosi (bagliore sui siti di scavo).'
            : 'Nessun tell visivo sui contenitori.';
        case 'passo-di-bastet':
          return level > 0
            ? 'La schivata concede 0.12s di invulnerabilita (i-frame).'
            : 'Nessuna invulnerabilita durante la schivata.';
        case 'sangue-di-ra':
          return level > 0
            ? 'Una maledizione puo essere deposta per piano (flag attivo nel VS).'
            : 'Nessuna capacita di deporre maledizioni.';
        default:
          return 'Nessun dettaglio runtime disponibile.';
      }
    }

    const floor = sliceState?.floor;
    const rooms = sliceState?.sceneLayout.rooms.map((room) => ({
      roomId: Number(room.roomId),
      role: room.role,
      revealed:
        room.roomId === floor?.entryRoomId ||
        room.roomId === floor?.exitRoomId ||
        room.roomId === floor?.mapRoomId ||
        runtimeGameplayState.revealedRoomIds.includes(Number(room.roomId)),
      isEntry: room.roomId === floor?.entryRoomId,
      isExit: room.roomId === floor?.exitRoomId,
      isTarget: room.roomId === sliceState?.sceneLayout.targetRoomId,
    })) ?? [];

    return {
      floorId: sliceState?.floor.floorId ?? 'fallback-floor',
      floorSummary: sliceState?.floorSummary ?? 'Nessun piano attivo',
      fragments: progressionState.fragments,
      bestiaryEntries: progressionState.bestiary.map((entry) => {
        const def = ENEMIES[entry as keyof typeof ENEMIES];
        return {
          id: entry,
          name: def.name,
          summary: `Tier ${def.tier} · HP ${def.baseHp} · Vista ${def.viewRadiusM}m · Udito ${def.hearRadiusM}m`,
        };
      }),
      discoveredGrafts: progressionState.discoveredGrafts,
      revealedRoomCount: runtimeGameplayState.revealedRoomIds.length,
      rooms,
      kaNodes: KA_TREE.map((node) => ({
        id: node.id,
        name: node.name,
        description: node.description,
        cost: node.cost,
        maxLevel: node.maxLevel,
        currentLevel: getNodeLevel(node.id, progressionState),
        affordable: canPurchase(progressionState, node.id),
        status: describeKaNodeStatus(
          node.id,
          getNodeLevel(node.id, progressionState),
        ),
      })),
    };
  }

  function refreshProgressionOverlay(): void {
    if (!progressionOverlay.visible) {
      return;
    }
    progressionOverlay.refresh(buildProgressionOverlayData());
  }

  function resumeFromProgressionOverlay(): void {
    progressionOverlay.hide();
    localResume('manual');
    if (pendingPointerLockRestore && !tutorialShown && !document.hidden) {
      requestCanvasPointerLock();
    }
  }

  function focusCanvas(): void {
    if (!renderer) return;
    renderer.canvas.focus({ preventScroll: true });
  }

  function requestCanvasPointerLock(): void {
    if (!renderer) return;
    if (isCanvasPointerLocked()) {
      pendingPointerLockRestore = false;
      syncPointerLockState();
      return;
    }
    focusCanvas();
    pendingPointerLockRestore = true;
    syncPointerLockState();
    void renderer.canvas.requestPointerLock();
  }

  function isCanvasPointerLocked(): boolean {
    return document.pointerLockElement === renderer?.canvas;
  }

  function syncPointerLockState(): void {
    if (!renderer) return;
    renderer.canvas.dataset.pointerLock =
      isCanvasPointerLocked()
        ? 'locked'
        : pendingPointerLockRestore
          ? 'pending'
          : 'unlocked';
  }

  function onPointerLockChange(): void {
    if (isCanvasPointerLocked()) {
      pendingPointerLockRestore = false;
      suppressNextPointerLockLoss = false;
      syncPointerLockState();
      return;
    }

    if (suppressNextPointerLockLoss) {
      suppressNextPointerLockLoss = false;
      syncPointerLockState();
      return;
    }

    const shouldArmRecovery =
      state === 'running' &&
      !document.hidden &&
      !tutorialShown &&
      !settingsMenu.visible;
    if (shouldArmRecovery) {
      pendingPointerLockRestore = true;
      focusCanvas();
      hud.showMessage('Mouse sganciato. Clicca per riprendere il controllo', 2200);
    }
    syncPointerLockState();
  }

  function installPointerLockListeners(): void {
    document.addEventListener('pointerlockchange', onPointerLockChange);
    detachPointerLockListeners = () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }

  function syncViewportSize(canvas: HTMLCanvasElement): void {
    if (state === 'disposed') return;
    applyViewportMetrics(canvas, renderer, window.devicePixelRatio || 1);
  }

  function installViewportListeners(canvas: HTMLCanvasElement): void {
    const viewport = window.visualViewport;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
          scheduleResize();
        })
        : null;
    const scheduleResize = (): void => {
      if (viewportResizeRaf !== 0) return;
      viewportResizeRaf = window.requestAnimationFrame(() => {
        viewportResizeRaf = 0;
        syncViewportSize(canvas);
      });
    };

    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);
    viewport?.addEventListener('resize', scheduleResize);
    resizeObserver?.observe(canvas);
    if (canvas.parentElement) {
      resizeObserver?.observe(canvas.parentElement);
    }

    detachViewportListeners = () => {
      window.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);
      viewport?.removeEventListener('resize', scheduleResize);
      resizeObserver?.disconnect();
      if (viewportResizeRaf !== 0) {
        window.cancelAnimationFrame(viewportResizeRaf);
        viewportResizeRaf = 0;
      }
    };
  }

  function currentWeapon(): WeaponDefinition {
    return weapons[currentWeaponIndex] ?? WEAPON_KHOPESH;
  }

  function isWeaponUnlocked(index: number): boolean {
    if (index === 2) {
      return runtimeBonuses.startsWithStaff;
    }
    return index >= 0 && index < weapons.length;
  }

  function buildWeaponSlotLabels(): readonly (string | null)[] {
    return weapons.map((weapon, index) => (isWeaponUnlocked(index) ? weapon.name : null));
  }

  function buildRuntimeSettings(): RuntimeSettings {
    return {
      accessibility: { ...config.accessibility },
      controls: {
        mouseSensitivity: config.controls.mouseSensitivity,
        mouseSmoothing: config.controls.mouseSmoothing,
        invertY: config.controls.invertY,
        bindings: actionMap.entries().map((entry) => ({
          action: entry.action,
          label: entry.label,
          bindings: cloneBindings(entry.bindings),
        })),
      },
      render: {
        fov: config.render.fov,
      },
    };
  }

  function applyRuntimeSettings(settings: RuntimeSettings): void {
    config.accessibility = { ...settings.accessibility };
    config.controls = {
      ...config.controls,
      mouseSensitivity: settings.controls.mouseSensitivity,
      mouseSmoothing: settings.controls.mouseSmoothing,
      invertY: settings.controls.invertY,
    };
    config.render = { ...config.render, fov: settings.render.fov };
    actionMap = applyActionBindingOverrides(
      createActionMap(),
      settings.controls.bindings.map((binding) => ({
        action: binding.action,
        bindings: binding.bindings,
      })),
    );
    input.setActionMap(actionMap);
    syncSprintToggleSetting(accessibilityToggleRuntime, config.accessibility.sprintToggle);
    applyPresentationSettings();
    hud.applyPresentation({
      textScale: config.accessibility.textScale,
      highContrast: config.accessibility.highContrast,
      colorBlindMode: config.accessibility.colorBlindMode,
      showDarknessBar: config.accessibility.showDarknessBar,
      soundIndicator: config.accessibility.soundIndicator,
      staticCrosshair: config.accessibility.staticCrosshair,
    });
    // C-03: i sottotitoli seguono le impostazioni di accessibilità.
    hud.setSubtitlePreferences({
      names: config.accessibility.subtitleNames,
      directions: config.accessibility.subtitleDirections,
    });
    settingsMenu.applyPresentation({
      textScale: config.accessibility.textScale,
      highContrast: config.accessibility.highContrast,
      colorBlindMode: config.accessibility.colorBlindMode,
    });
    progressionOverlay.applyPresentation({
      textScale: config.accessibility.textScale,
      highContrast: config.accessibility.highContrast,
      colorBlindMode: config.accessibility.colorBlindMode,
    });
    deathOverlay.applyPresentation({
      textScale: config.accessibility.textScale,
      highContrast: config.accessibility.highContrast,
      colorBlindMode: config.accessibility.colorBlindMode,
    });
    mainMenu?.applyPresentation({
      textScale: config.accessibility.textScale,
      highContrast: config.accessibility.highContrast,
      colorBlindMode: config.accessibility.colorBlindMode,
    });
  }

  function applyPresentationSettings(): void {
    renderer?.applyPresentation({
      fovDeg: config.render.fov,
      highContrast: config.accessibility.highContrast,
      colorBlindMode: config.accessibility.colorBlindMode,
      assistedLight: config.accessibility.assistedLight,
      reduceTorchFlicker: config.accessibility.reduceTorchFlicker,
      amplifiedTelegraphs: config.accessibility.amplifiedTelegraphs,
      reduceCameraShake: config.accessibility.reduceCameraShake,
      disableMotionBlur: config.accessibility.disableMotionBlur,
    });
  }

  function persistRuntimeSettings(): void {
    if (!saveManager || !saveData) {
      return;
    }

    const nextSave = writeRuntimeSettingsToSave(saveData, buildRuntimeSettings());
    saveData = nextSave;
    profilePersistPromise = saveManager.save(nextSave).catch((err: unknown) => {
      log.error('Salvataggio impostazioni runtime fallito', { error: String(err) });
    });
  }

  function persistProfile(reason: string): Promise<void> {
    if (!saveManager || !saveData) {
      return Promise.resolve();
    }

    const snapshot = saveData;
    profilePersistPromise = saveManager.save(snapshot).catch((err: unknown) => {
      log.error('Salvataggio profilo fallito', {
        reason,
        error: String(err),
      });
    });
    return profilePersistPromise;
  }

  // C-02: probe WebXR — verifica supporto + sessione immersiva con esito
  // onesto. Il rendering VR vero (setAnimationLoop) è un prerequisito
  // documentato in roadmap (C-02): senza refactor del loop non si finge.
  async function probeWebXr(): Promise<void> {
    if (typeof navigator === 'undefined' || !('xr' in navigator)) {
      hud.showMessage('WebXR non disponibile in questo browser.', 3200);
      return;
    }
    try {
      const xr = navigator.xr;
      if (xr === undefined) {
        hud.showMessage('WebXR non disponibile in questo browser.', 3200);
        return;
      }
      const supported = await xr.isSessionSupported('immersive-vr');
      if (!supported) {
        hud.showMessage('Nessun visore WebXR rilevato.', 3200);
        return;
      }
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor'],
      });
      renderer?.enableXr?.(session);
      hud.showMessage('Sessione WebXR avviata. Il rendering VR richiede la build dedicata (C-02).', 4200);
      log.info('WebXR: sessione immersiva avviata');
    } catch (error) {
      hud.showMessage('Avvio WebXR fallito.', 3000);
      log.warn('WebXR probe fallito', { error: String(error) });
    }
  }

  // C-03: posizione di un evento con tipo locale (evita il conflitto
  // lint/TSC sul narrowing del campo position nei case del drain).
  function eventPosition(
    event: { readonly position?: { readonly x: number; readonly z: number } | null },
  ): { readonly x: number; readonly z: number } {
    const position = event.position;
    return position === undefined || position === null
      ? { x: 0, z: 0 }
      : { x: position.x, z: position.z };
  }

  function showDeathOverlay(canRetry: boolean): void {
    // G-18: cue di morte del player (una sola volta per run fallita)
    audio.play({ name: 'player_death', volume: 0.6 });
    // C-01: registra la run nella classifica locale e costruisce l'URL seed.
    const floorSeed = sliceState?.floor.seed ?? 0;
    const board = submitRunScore(
      {
        runId: runStats.runId,
        floorReached: runStats.floorsCleared,
        goldEarned: runStats.goldEarned,
        enemiesDefeated: runStats.enemiesDefeated,
        seed: floorSeed,
      },
      window.localStorage,
    );
    const shareUrl = shareSeedUrl(floorSeed, window.location);
    deathOverlay.show({
      cause: deathCause,
      fragments: saveData?.payload.fragments ?? null,
      canRetry,
      // Run summary (v2): chiude il loop roguelike con le statistiche
      floorsCleared: runStats.floorsCleared,
      enemiesDefeated: runStats.enemiesDefeated,
      goldEarned: runStats.goldEarned,
      leaderboard: board,
      shareUrl,
    });
  }

  /**
   * G-18 V3: intro cinematografica — la camera panoramica la stanza d'ingresso
   * e la torcia posata da raccogliere (3.2s), poi cede il controllo al player.
   */
  function startIntroCinematic(): void {
    if (introStarted || !sliceState || !playerController) return;
    introStarted = true;
    introCinematicUntilMs = performance.now() + 3200;
    const spawn = sliceState.sceneLayout.entrySpawn;
    // Torcia posata 1.9m davanti allo spawn (direzione di default -Z), accesa
    // per illuminare la stanza e attirare l'occhio. NOTA: NON a 2.2m — il
    // raggio di pickup è 2.2m e il player si assesta di ~0.4mm all'avvio
    // (Rapier), rendendo il pickup impossibile al limite esatto (bug e2e).
    introTorchPosition = {
      x: spawn.x,
      y: 0.62,
      z: spawn.z - 1.9,
    };
    renderer?.setPlacedTorchState({
      x: introTorchPosition.x,
      y: introTorchPosition.y,
      z: introTorchPosition.z,
    });
    hud.showMessage('Raccogli la torcia (E) per iniziare la discesa.', 3200);
    log.info('Intro cinematografica avviata', { untilMs: introCinematicUntilMs });
  }

  /**
   * G-18 V3: raccolta della torcia introduttiva — con E vicino alla torcia
   * posata il player la prende, la torcia si accende e l'intro termina.
   */
  function tryPickUpIntroTorch(playerPosition: { readonly x: number; readonly y: number; readonly z: number } | null): boolean {
    if (!introStarted || !introTorchPosition || !playerPosition) return false;
    const distanceM = Math.hypot(
      playerPosition.x - introTorchPosition.x,
      playerPosition.z - introTorchPosition.z,
    );
    if (distanceM > PLACED_TORCH_PICKUP_RADIUS_M) {
      return false;
    }
    // Raccoglie: la torcia si accende (TOGGLE su OFF → HIGH), la posata sparisce.
    const resolved = runTorchAction('TOGGLE');
    introTorchPosition = null;
    renderer?.setPlacedTorchState(null);
    introCinematicUntilMs = 0;
    syncWorldInteractables();
    syncTorchPresentation();
    hud.showMessage('Torcia in pugno. La discesa comincia.', 2000);
    audio.play({ name: 'brazier_ignite', volume: 0.5 });
    if (!resolved.result.changed) {
      log.warn('Intro torch pickup: TOGGLE senza cambiamento di stato');
    }
    // Il tutorial dei comandi appare dopo la raccolta (non copre l'intro).
    if (!tutorialShown) {
      hud.showTutorial();
      tutorialShown = true;
    }
    log.info('Torcia introduttiva raccolta', { distanceM });
    return true;
  }

  /**
   * G-05: raccolta del reliquiario — con E vicino al tesoro dissotterrato si
   * emette TREASURE_FOUND (ricompensa reale: frammenti + graft) e l'oggetto
   * sparisce. Loot fisico nel mondo, non ricompensa astratta.
   */
  function tryPickUpLootReliquary(playerPosition: { readonly x: number; readonly y: number; readonly z: number } | null): boolean {
    if (!pendingLoot || !playerPosition) return false;
    const distanceM = Math.hypot(
      playerPosition.x - pendingLoot.x,
      playerPosition.z - pendingLoot.z,
    );
    if (distanceM > PLACED_TORCH_PICKUP_RADIUS_M) {
      return false;
    }
    // Emette l'evento di ricompensa (RunProgression: frammenti + graft)
    simulation.events.emit({
      kind: 'TREASURE_FOUND',
      position: { x: pendingLoot.x, y: 0, z: pendingLoot.z },
      data: { siteId: pendingLoot.siteId },
    });
    renderer?.setLootReliquary(null);
    const lootX = pendingLoot.x;
    const lootZ = pendingLoot.z;
    pendingLoot = null;
    hud.showMessage('Reliquiario aperto: la ricompensa è tua.', 2200, subtitleDirectionTo(lootX, lootZ));
    // Tutorial graduale: gli innesti scoperti si gestiscono nella mappa.
    hud.showContextualHint({
      id: 'hint-relic',
      text: 'Tesoro! Gli innesti scoperti si equipaggiano dalla mappa (TAB).',
    });
    audio.play({ name: 'treasure_found', volume: 0.6 });
    log.info('Reliquiario raccolto', { distanceM });
    return true;
  }

  function syncProgressionRuntimeBonuses(): void {
    const progressionState = saveData
      ? getProgressionState(saveData)
      : {
        fragments: 0,
        purchasedNodes: {},
        bestiary: [],
        discoveredGrafts: [],
      };
    const bonuses = getRuntimeBonuses(
      progressionState,
      TORCH.initialFuelSeconds,
      PLAYER.baseHealthHp,
    );
    runtimeBonuses = bonuses;
    const previousTorchCapacity = torchRuntime.capacitySeconds;
    torchRuntime = {
      ...torchRuntime,
      capacitySeconds: bonuses.torchCapacitySeconds,
      fuelSeconds: remapCurrentValueToNewMaximum(
        torchRuntime.fuelSeconds,
        previousTorchCapacity,
        bonuses.torchCapacitySeconds,
      ),
    };
    playerMaxHp = bonuses.playerMaxHp;
    // G-05: modifier di combattimento dai graft scoperti nel profilo.
    combatModifiers = resolveCombatModifiers(
      upgradesFromNames(progressionState.discoveredGrafts, ALL_UPGRADES),
    );
    if (!isWeaponUnlocked(currentWeaponIndex)) {
      currentWeaponIndex = 1;
      weaponName = currentWeapon().name;
    }
    // Occhio del Ladro: tell visivo sul sito di scavo quando il nodo è attivo.
    renderer?.setDangerTell(bonuses.hasLootDangerTell);

    if (playerEntityId === null) {
      return;
    }

    const playerHealth = currentPlayerHealth();
    if (!playerHealth) {
      return;
    }

    simulation.world.health.set(
      playerEntityId,
      remapCurrentValueToNewMaximum(playerHealth.hp, playerHealth.maxHp, bonuses.playerMaxHp),
      bonuses.playerMaxHp,
    );
  }

  function distanceXZ(
    a: { readonly x: number; readonly z: number },
    b: { readonly x: number; readonly z: number },
  ): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  function currentPlayerPosition(): { readonly x: number; readonly y: number; readonly z: number } | null {
    return playerController?.getState().position ?? null;
  }

  function unlockAudio(): void {
    void audio.unlock().then(() => {
      // G-19/Kenney: carica gli asset audio reali dopo lo sblocco
      // (fire-and-forget; i cue usano il sintetico finché non sono pronti).
      void audio.loadAssets();
    });
  }

  function syncAudioListener(): void {
    const playerPosition = currentPlayerPosition();
    if (!playerPosition) {
      return;
    }

    const cosPitch = Math.cos(cameraPitch);
    const forwardX = Math.sin(cameraYaw) * cosPitch;
    const forwardY = Math.sin(cameraPitch);
    const forwardZ = Math.cos(cameraYaw) * cosPitch;

    audio.setListenerPosition(
      playerPosition.x,
      playerPosition.y + EYE_HEIGHT_OFFSET_M,
      playerPosition.z,
    );
    audio.setListenerOrientation(forwardX, forwardY, forwardZ, 0, 1, 0);
  }

  function currentPlayerHealth(): { readonly hp: number; readonly maxHp: number } | null {
    if (playerEntityId === null) {
      return null;
    }

    const health = simulation.world.health.get(playerEntityId);
    if (!health) {
      return null;
    }

    return {
      hp: health.currentHp,
      maxHp: health.maxHp,
    };
  }

  function applyDamageToPlayer(
    baseDamageHp: number,
    position: { readonly x: number; readonly y: number; readonly z: number },
    source: string,
  ): number {
    if (playerEntityId === null || baseDamageHp <= 0) {
      return 0;
    }

    // Passo di Bastet: i-frame della schivata annullano il danno subito.
    if (runtimeBonuses.hasDodgeIFrames && performance.now() < dodgeIFramesUntilMs) {
      hud.showMessage('Schivata perfetta: il colpo attraversa il Ka.', 800);
      return 0;
    }

    // Parry: gli i-frame della parata proteggono dagli attacchi degli ALTRI
    // nemici mentre la finestra è attiva (l'attacco parato viene già
    // annullato dal runtime con parried: true).
    if (parryWindowActive(parryIFramesUntilMs, performance.now())) {
      hud.showMessage('Parata: il colpo rimbalza sulla guardia.', 700);
      return 0;
    }

    const outcome = resolveDamage({
      baseDamageHp,
      attackModifier: 1,
      sourceModifier: 1,
      targetArmor: 0,
      resistanceMultiplier: 1,
      isCritical: false,
      criticalMultiplier: 1,
    });
    if (outcome.finalDamageHp <= 0) {
      return 0;
    }

    // NEW-3: "Sigillo di Sobek" — il danno subito aumenta del 20%
    const finalDamageHp = activeCurse?.definition.id === 'sigillo-di-sobek'
      ? Math.ceil(outcome.finalDamageHp * 1.2)
      : outcome.finalDamageHp;

    let remainingHp = simulation.world.health.damage(playerEntityId, finalDamageHp);
    // G-07: feedback visivo del danno subito — vibrazione camera proporzionale,
    // attenuata da reduceCameraShake nel renderer.
    renderer?.addCameraShake(Math.min(1, 0.35 + outcome.finalDamageHp / 60));
    // Tutorial graduale: primo danno subito e soglia critica (una volta sola).
    if (remainingHp > 0 && remainingHp <= Math.round(playerMaxHp * 0.3)) {
      hud.showContextualHint({
        id: 'hint-lowhp',
        text: 'HP critico: para (CLICK DX) e schiva (SPAZIO) — un altro colpo può essere fatale.',
      });
    }
    if (remainingHp <= 0 && runtimeBonuses.hasAnubiRevive && !anubiReviveConsumed) {
      anubiReviveConsumed = true;
      remainingHp = Math.max(1, Math.round(playerMaxHp * 0.3));
      simulation.world.health.set(playerEntityId, remainingHp, playerMaxHp);
      hud.showMessage('Patto di Anubi: il Ka ti richiama alla vita.', 2600);
    }

    simulation.events.emit({
      kind: 'PLAYER_DAMAGED',
      entityId: playerEntityId,
      position,
      data: {
        source,
        damageHp: outcome.finalDamageHp,
        remainingHp,
      },
    });
    // Tutorial graduale: il danno subito insegna a gestire la torcia e la
    // distanza (dedupe per id).
    hud.showContextualHint({
      id: 'hint-damage',
      text: 'Hai subito un colpo: tieni la torcia accesa per vedere i telegrafi e schiva (Spazio) gli attacchi.',
    });
    if (remainingHp <= 0) {
      simulation.events.emit({
        kind: 'PLAYER_DIED',
        entityId: playerEntityId,
        position,
        data: { source },
      });
    }

    return outcome.finalDamageHp;
  }

  function currentTorchEventPosition(): GameplayEventPosition | undefined {
    return currentPlayerPosition() ?? placedTorchPosition ?? undefined;
  }

  function emitTorchRuntimeEvents(
    previousRuntime: TorchRuntime,
    result: TorchStepResult,
    position = currentTorchEventPosition(),
  ): void {
    emitTorchEvents(simulation.events, previousRuntime, result, position);
  }

  function drainPendingFrameEvents(target: DomainEvent[]): void {
    target.push(...simulation.events.flush());
    simulation.events.clearFrame();
  }

  function handleFrameEvents(events: readonly DomainEvent[]): void {
    let shouldPersistProfile = false;
    let playerDiedThisFrame = false;
    const listenerPosition = currentPlayerPosition();

    for (const event of events) {
      const runtimeGameplay = applyRuntimeGameplayEvent(runtimeGameplayState, event);
      if (runtimeGameplay.changed) {
        runtimeGameplayState = runtimeGameplay.state;
      }
      if (runtimeGameplay.goldAdded > 0) {
        hud.showMessage(`+${runtimeGameplay.goldAdded} monete d'oro`, 1600);
        // G-18: cue monete (sintetico, pitch leggero).
        audio.play({ name: 'gold_pickup', volume: 0.5 });
        // Tutorial graduale: l'oro diventa Frammenti di Ka alla morte.
        hud.showContextualHint({
          id: 'hint-gold',
          text: "L'oro raccolto si converte in Frammenti di Ka alla morte: non temere di spenderlo.",
        });
      }
      const runtimeStimulus = applyRuntimeStimulusEvent(runtimeStimulusState, event);
      if (runtimeStimulus.changed) {
        runtimeStimulusState = runtimeStimulus.state;
      }

      if (saveData) {
        const progression = applyProgressionEventToSave(saveData, event);
        if (progression.changed) {
          saveData = progression.save;
          shouldPersistProfile = true;
          if (progression.fragmentDelta > 0) {
            audio.play({ name: 'fragment_pickup', volume: 0.6 });
            hud.showMessage(`+${progression.fragmentDelta} Frammenti di Ka`, 2200);
          }
          if (progression.unlockedBestiaryEntry) {
            hud.showMessage(
              `Bestiario aggiornato: ${progression.unlockedBestiaryEntry}`,
              2200,
            );
          }
          if (progression.unlockedGraft) {
            hud.showMessage(`Innesto scoperto: ${progression.unlockedGraft}`, 2200);
          }
          refreshProgressionOverlay();
        }
      }
      shouldPersistProfile ||= shouldPersistAfterEvent(event);

      const feedback = deriveEventFeedback(event, listenerPosition);
      if (feedback.cue) {
        audio.play(feedback.cue);
      }
      if (feedback.indicatorText) {
        hud.showSoundIndicator(feedback.indicatorText, 1600);
      }

      switch (event.kind) {
        case 'TORCH_FUEL_LOW':
          hud.showMessage('La torcia vacilla: resta poco combustibile.', 2200);
          hud.showContextualHint({
            id: 'hint-fuel-low',
            text: 'Torcia quasi spenta: cerca un braciere per ricaricarla (E).',
          });
          break;
        case 'TORCH_FUEL_EMPTY':
          hud.showMessage('💀 Torcia esausta! Cerca un braciere...');
          break;
        case 'DIG_PROGRESS': {
          const segmentIndex = event.data?.segmentIndex;
          if (typeof segmentIndex === 'number') {
            hud.showMessage(`Scavo ${segmentIndex + 1}/4 completato.`, 1500);
            // G-15 V3: polvere di sabbia sul colpo di pala.
            if (event.position && renderer) {
              renderer.emitSparks(
                {
                  x: event.position.x,
                  y: event.position.y + 0.4,
                  z: event.position.z,
                },
                0x8a7350,
                16,
              );
            }
          }
          break;
        }
        case 'DIG_COMPLETE':
          // G-05: il tesoro NON viene dato subito — appare un reliquiario
          // fisico che il player raccoglie con E (loot nel mondo).
          pendingLoot = {
            x: event.position?.x ?? 0,
            z: event.position?.z ?? 0,
            siteId: typeof event.data?.siteId === 'string' ? event.data.siteId : '',
          };
          if (event.position && renderer) {
            renderer.setLootReliquary({
              x: event.position.x,
              y: 0,
              z: event.position.z,
            });
          }
          {
            const digPos = eventPosition(event);
            hud.showMessage('Un reliquiario emerge dalla sabbia. Raccoglilo (E).', 2600, subtitleDirectionTo(digPos.x, digPos.z));
          }
          // A-01: ricompensa bonus deterministica (oro / Frammenti / graft raro)
          // — sopra i Frammenti garantiti del reliquiario (TREASURE_FOUND).
          {
            const floorSeed = sliceState?.floor.seed ?? 0;
            const siteX = Math.round(event.position === undefined ? 0 : event.position.x);
            const siteZ = Math.round(event.position === undefined ? 0 : event.position.z);
            const tier = sliceState === null ? 1 : sliceState.sceneLayout.floorIndex;
            const loot = rollDigLoot(floorSeed, siteX, siteZ, tier);
            if (loot.kind === 'gold' && loot.amount > 0) {
              runtimeGameplayState = {
                ...runtimeGameplayState,
                goldCoins: runtimeGameplayState.goldCoins + loot.amount,
              };
              hud.showMessage(`+${loot.amount} monete d'oro dal tesoro.`, 1800);
              audio.play({ name: 'gold_pickup', volume: 0.5 });
            } else if (loot.kind === 'fragments' && loot.amount > 0 && saveData) {
              saveData = {
                ...saveData,
                payload: {
                  ...saveData.payload,
                  fragments: saveData.payload.fragments + loot.amount,
                },
              };
              shouldPersistProfile = true;
              hud.showMessage(`+${loot.amount} Frammenti di Ka dal tesoro.`, 1800);
              audio.play({ name: 'fragment_pickup', volume: 0.6 });
            } else if (loot.kind === 'graft' && loot.graftName !== undefined && saveData) {
              if (!saveData.payload.discoveredGrafts.includes(loot.graftName)) {
                saveData = {
                  ...saveData,
                  payload: {
                    ...saveData.payload,
                    discoveredGrafts: [...saveData.payload.discoveredGrafts, loot.graftName],
                  },
                };
                shouldPersistProfile = true;
                hud.showMessage(`Innesto scoperto: ${loot.graftName}!`, 2400);
              }
            }
          }
          break;
        case 'BRAZIER_LIT': {
          const brazierPos = eventPosition(event);
          hud.showMessage('Braciere acceso. La cripta arretra per un istante.', 2000, subtitleDirectionTo(brazierPos.x, brazierPos.z));
          hud.showContextualHint({
            id: 'hint-brazier',
            text: "Braciere acceso: l'oscurità arretra e la mappa si rivela.",
          });
          // A-01: il braciere è un presidio territoriale — il Director evita
          // di spawnare nemici nella stanza illuminata (se ci sono alternative).
          if (event.position && enemySpawnDirector) {
            const litBrazier = sliceState?.sceneLayout.braziers.find(
              (candidate) =>
                Math.abs(candidate.position.x - brazierPos.x) < 0.5 &&
                Math.abs(candidate.position.z - brazierPos.z) < 0.5,
            );
            if (litBrazier) {
              enemySpawnDirector.setLitRoom(litBrazier.roomId, true);
              log.info('Braciere: stanza presidiata dalla luce', { roomId: litBrazier.roomId });
            }
          }
          break;
        }
        case 'DARKNESS_RELIEF':
          if (runtimeGameplay.darknessReliefApplied > 0) {
            hud.showMessage(`Oscurita ridotta di ${runtimeGameplay.darknessReliefApplied}.`, 1800);
          }
          break;
        case 'MAP_REVEAL':
          if (runtimeGameplay.revealedRoomId !== null) {
            hud.showMessage('Una stanza della piramide si rivela sulla mappa.', 1800);
          }
          break;
        case 'PLAYER_DIED':
          playerDiedThisFrame = true;
          deathCause =
            typeof event.data?.source === 'string'
              ? event.data.source
              : 'minaccia sconosciuta';
          break;
      }
    }

    if (shouldPersistProfile) {
      void persistProfile('eventi gameplay runtime');
    }

    if (playerDiedThisFrame) {
      // §11.1 "Nota di gentilezza": 20% dell'oro della run diventa Frammenti.
      if (saveData && runtimeGameplayState.goldCoins > 0) {
        const conversion = convertRunGoldToFragments(
          saveData,
          runtimeGameplayState.goldCoins,
        );
        if (conversion.fragmentDelta > 0) {
          saveData = conversion.save;
          hud.showMessage(
            `Il Ka custodisce ${conversion.fragmentDelta} Frammenti dalla tua run.`,
            3200,
          );
        }
      }
      // Run summary (v2): cattura l'oro finale prima del reset della run
      runStats = {
        ...runStats,
        goldEarned: runStats.goldEarned + runtimeGameplayState.goldCoins,
      };
      settingsMenu.hide();
      progressionOverlay.hide();
      localPause('death');
      showDeathOverlay(false);
      void profilePersistPromise.finally(() => {
        deathOverlay.setRetryEnabled(true);
      });
    }
  }

  function syncWorldInteractables(): void {
    renderer?.setPlacedTorchState(placedTorchPosition);
    renderer?.setBrazierStates(
      brazierStates.map<RendererBrazierState>((brazier) => {
        const sceneBrazier = sliceState?.sceneLayout.braziers.find(
          (candidate) => candidate.brazierId === brazier.brazierId,
        );
        return {
          brazierId: brazier.brazierId,
          x: sceneBrazier?.position.x ?? 0,
          y: sceneBrazier?.position.y ?? 0.35,
          z: sceneBrazier?.position.z ?? 0,
          lit: brazier.lit,
          refillUsed: brazier.refillUsed,
        };
      }),
    );
  }

  function syncTorchPresentation(): void {
    const presentation = deriveTorchPresentation(torchRuntime);
    torchLit = presentation.hudTorchLit;
    torchPlaced = presentation.torchPlaced;
    if (torchRuntime.state !== 'PLACED') {
      placedTorchPosition = null;
    }
    renderer?.setTorchLit(presentation.handLightOn);
    syncWorldInteractables();
  }

  function runTorchAction(action: TorchActionKind, durationMs = 1800) {
    const previousRuntime = torchRuntime;
    const resolved = resolveTorchAction(torchRuntime, action);
    const { result, message } = resolved;
    torchRuntime = result.runtime;
    emitTorchRuntimeEvents(previousRuntime, result);
    syncTorchPresentation();
    if (message) {
      hud.showMessage(message, durationMs);
    }
    return resolved;
  }

  function isNearPlacedTorch(playerPosition: { readonly x: number; readonly z: number }): boolean {
    if (!placedTorchPosition) return false;
    return distanceXZ(playerPosition, placedTorchPosition) <= PLACED_TORCH_PICKUP_RADIUS_M;
  }

  function findNearbyBrazier(
    playerPosition: { readonly x: number; readonly z: number },
  ): { state: BrazierState; x: number; y: number; z: number } | null {
    if (!sliceState) return null;

    let best:
      | { state: BrazierState; x: number; y: number; z: number; distance: number }
      | null = null;

    for (const brazierState of brazierStates) {
      const sceneBrazier = sliceState.sceneLayout.braziers.find(
        (candidate) => candidate.brazierId === brazierState.brazierId,
      );
      if (!sceneBrazier) continue;

      const distance = distanceXZ(playerPosition, sceneBrazier.position);
      if (distance > BRAZIER_INTERACT_RADIUS_M) continue;
      if (!best || distance < best.distance) {
        best = {
          state: brazierState,
          x: sceneBrazier.position.x,
          y: sceneBrazier.position.y,
          z: sceneBrazier.position.z,
          distance,
        };
      }
    }

    if (!best) return null;
    return best;
  }

  function isNearDigSite(playerPosition: { readonly x: number; readonly z: number }): boolean {
    if (!digSite) return false;
    return distanceXZ(playerPosition, { x: digSite.positionX, z: digSite.positionZ }) <= DIG_SITE_INTERACT_RADIUS_M;
  }

  function tryHandleBrazierInteract(): boolean {
    const playerPosition = currentPlayerPosition();
    if (!playerPosition) return false;

    const nearby = findNearbyBrazier(playerPosition);
    if (!nearby) return false;

    if (torchRuntime.state === 'PLACED') {
      hud.showMessage('Raccogli la torcia prima di usare il braciere.', 1800);
      return true;
    }

    if (!nearby.state.lit) {
      const ignition = igniteBrazier(nearby.state, torchRuntime.fuelSeconds);
      if (!ignition) {
        hud.showMessage('Serve una torcia accesa e abbastanza combustibile.', 1800);
        return true;
      }
      const previousRuntime = torchRuntime;
      torchRuntime = {
        ...torchRuntime,
        fuelSeconds: Math.max(0, torchRuntime.fuelSeconds - ignition.fuelCost),
      };
      emitTorchRuntimeEvents(previousRuntime, {
        runtime: torchRuntime,
        changed: true,
        effects: [],
      }, nearby);
      emitBrazierEvents(simulation.events, ignition.effects, nearby);
      syncTorchPresentation();
      hud.showMessage('Braciere acceso. La stanza respira di nuovo.', 2200);
      hud.showContextualHint({
        id: 'hint-brazier',
        text: "Braciere acceso: l'oscurità arretra e la mappa si rivela.",
      });
      return true;
    }

    const refillAmount = refillFromBrazier(
      nearby.state,
      torchRuntime.fuelSeconds,
      torchRuntime.capacitySeconds,
    );
    if (refillAmount <= 0) {
      hud.showMessage(
        nearby.state.refillUsed
          ? 'Questo braciere ha già ceduto tutta la sua brace.'
          : 'La torcia è già al massimo.',
        1800,
      );
      syncWorldInteractables();
      return true;
    }

    const previousRuntime = torchRuntime;
    torchRuntime = {
      ...torchRuntime,
      fuelSeconds: Math.min(torchRuntime.capacitySeconds, torchRuntime.fuelSeconds + refillAmount),
    };
    emitTorchRuntimeEvents(previousRuntime, {
      runtime: torchRuntime,
      changed: true,
      effects: [],
    }, nearby);
    syncTorchPresentation();
    hud.showMessage(`Torcia ricaricata di ${Math.round(refillAmount)}s.`, 1800);
    return true;
  }

  async function generateFloorWithFallback(floorIndex = 1, seedOverride: number | null = null): Promise<VerticalSliceState> {
    // G-10: il piano 1 usa il seed base (back-compat con il VS storico); i
    // piani successivi usano il seed derivato — run riproducibile, piani indipendenti.
    const baseSeed = config.debug.fixedSeed ?? VERTICAL_SLICE_GENERATION_INPUT.seed;
    const input = {
      ...VERTICAL_SLICE_GENERATION_INPUT,
      seed: seedOverride ?? (floorIndex <= 1 ? baseSeed : floorSeed(baseSeed, floorIndex)),
      floorIndex,
      preferEarlyMap: runtimeBonuses.guaranteesEarlyMap,
    };

    async function generateInMainThread(): Promise<VerticalSliceState> {
      const { generateFloor } = await runtimeModules.floorGenerator;
      return createVerticalSliceState(generateFloor(input));
    }

    if (!generationClient) {
      return generateInMainThread();
    }

    const client = generationClient;

    return new Promise<VerticalSliceState>((resolve) => {
      let settled = false;
      let requestId = 0;

      const settle = (state: VerticalSliceState): void => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        resolve(state);
      };

      const fallbackTimer = window.setTimeout(() => {
        if (settled) return;
        client.cancel(requestId);
        void generateInMainThread().then(settle);
      }, 1200);

      requestId = client.request(
        input,
        (floor) => {
          settle(createVerticalSliceState(floor));
        },
        () => {
          void generateInMainThread().then(settle);
        },
      );
    });
  }

  /**
   * G-10: discesa al piano successivo. Rigenera slice+layout con seed derivato,
   * ricrea Director/guardiana/bracieri/dig site, respawna il player alla entry.
   * Non tocca renderer/physics/playerController (persistono tra i piani).
   */
  async function descendToNextFloor(): Promise<boolean> {
    const nextIndex = currentFloorIndex + 1;
    if (nextIndex > MAX_FLOORS) {
      return false;
    }
    // Run summary (v2): il piano corrente è stato completato
    runStats = { ...runStats, floorsCleared: runStats.floorsCleared + 1 };

    const nextSlice = await generateFloorWithFallback(nextIndex);
    sliceState = nextSlice;
    currentFloorIndex = nextIndex;
    const progression = floorProgressionFor(nextIndex);
    // NEW-3: Sangue di Ra — depone una maledizione per piano (trade-off)
    if (runtimeBonuses.canDeposeCurse && activeCurse === null) {
      const curse = curseForFloor(config.debug.fixedSeed ?? VERTICAL_SLICE_GENERATION_INPUT.seed, nextIndex);
      activeCurse = { definition: curse, floorIndex: nextIndex };
      log.info('Maledizione deposta', { id: curse.id, floorIndex: nextIndex });
      hud.showMessage(`${curse.icon} Maledizione: ${curse.name} — ${curse.reward}`, 4200);
      // Tutorial graduale: le maledizioni sono trade-off, non punizioni.
      hud.showContextualHint({
        id: 'hint-curse',
        text: `Maledizione attiva: ${curse.name}. ${curse.reward} — Sangue di Ra la dissolve.`,
      });
      // Applica subito gli effetti (HP max, drenaggio torcia)
      const cursed = applyCurseEffects(activeCurse, {
        torchDrainRatio: 1,
        maxHp: playerMaxHp,
        damageTakenMultiplier: 1,
        goldMultiplier: 1,
      });
      playerMaxHp = cursed.maxHp;
      const playerHp = currentPlayerHealth();
      if (playerHp && playerEntityId !== null) {
        simulation.world.health.set(playerEntityId, Math.min(playerHp.hp, cursed.maxHp), cursed.maxHp);
      }
    }
    log.info('Discesa al piano successivo', {
      floorIndex: nextIndex,
      floorId: nextSlice.floor.floorId,
      theme: progression.theme,
      budget: progression.directorBudget,
      seed: nextSlice.floor.seed,
    });

    // Reset dei runtime per-piano
    scarabState = null;
    mummyState = null;
    genericEnemyState = null;
    enemyHurtboxes.clear();
    playerHitRegistry.clear();

    // Threat Director con budget del piano (difficoltà per composizione)
    enemySpawnDirector = createEnemySpawnDirector({
      sceneLayout: nextSlice.sceneLayout,
      entryRoomId: nextSlice.floor.entryRoomId,
      floorSeed: nextSlice.floor.seed,
      floorIndex: nextIndex,
      currentFuelSeconds: torchRuntime.fuelSeconds,
      metaNodes: saveData?.payload.kaNodes.length ?? 0,
      hadWipeThisFloor: false,
      baseBudget: progression.directorBudget,
    });
    const encounterPlan = enemySpawnDirector.planNext();
    if (encounterPlan?.enemyType === 'SCARAB') {
      const entityId = simulation.world.createEntity();
      scarabState = createScarabEncounterState(entityId, encounterPlan.position);
    } else if (encounterPlan) {
      const entityId = simulation.world.createEntity();
      genericEnemyState = createGenericEncounterState(
        entityId,
        encounterPlan.enemyType as import('@/content/enemies.js').EnemyArchetype,
        encounterPlan.position,
      );
      log.info('Director: spawn iniziale del nuovo piano', { enemyType: encounterPlan.enemyType });
    }
    if (encounterPlan) {
      // Tutorial graduale: primo incontro con un nemico (dedupe per id).
      hud.showContextualHint({
        id: 'hint-enemy',
        text: 'Nemico avvistato: colpisci col Click sinistro; se ti carica, schiva (Spazio) per evitare il colpo.',
      });
    }

    // Guardiana del nuovo piano (posizione del target)
    if (physicsWorld) {
      const { createSliceGuardianRuntime } = await runtimeModules.guardianRuntime;
      guardianRuntime = createSliceGuardianRuntime(
        physicsWorld,
        nextSlice.target.position,
        { radiusM: 0.45, heightM: 1.8 },
      );
    }
    guardianEntitySync = createSliceGuardianEntitySync(simulation.world, nextSlice.target);

    // Bracieri e dig site del nuovo piano
    brazierStates = nextSlice.sceneLayout.braziers.map((brazier) =>
      createBrazier(brazier.brazierId, Number(brazier.roomId)),
    );
    digSite = nextSlice.sceneLayout.digSite
      ? createDigSite(
        nextSlice.sceneLayout.digSite.siteId,
        Number(nextSlice.sceneLayout.digSite.roomId),
        nextSlice.sceneLayout.digSite.position.x,
        nextSlice.sceneLayout.digSite.position.z,
      )
      : null;

    // Layout al renderer + respawn player alla entry del piano.
    // v2: dissolvenza nera — copre il rebuild della scena (main thread) e
    // rende la discesa cinematografica invece di un frame drop visibile.
    cinematicOverlay?.fadeToBlack(true);
    await new Promise((resolve) => setTimeout(resolve, 380));
    renderer?.setFloorLayout(nextSlice.sceneLayout);
    renderer?.applyFloorPalette(progression.palette);
    syncWorldInteractables();
    if (playerController) {
      const spawn = nextSlice.sceneLayout.entrySpawn;
      playerController.teleport(spawn.x, PLAYER.capsuleHeightM / 2 + 0.05, spawn.z);
      // G-18 V4: doorway snap assist del nuovo piano
      playerController.setDoorways(
        nextSlice.sceneLayout.doorways.map((doorway) => ({
          x: doorway.center.x,
          z: doorway.center.z,
        })),
      );
    }
    syncVerticalSlicePresentation();
    syncTorchPresentation();
    cinematicOverlay?.fadeToBlack(false);
    hud.showMessage(`Piano ${nextIndex} — ${progression.theme}`, 2800);
    return true;
  }

  function syncVerticalSlicePresentation(nowMs = performance.now()): void {
    if (!sliceState) {
      renderer?.setEnemyStates([]);
      renderer?.setObjectiveState({ exitUnlocked: false, completed: false });
      return;
    }

    const enemyStates = [
      {
        x: sliceState.target.position.x,
        y: sliceState.target.position.y,
        z: sliceState.target.position.z,
        modelScale: 1,
        hpRatio:
          sliceState.target.maxHp <= 0 ? 0 : sliceState.target.hp / sliceState.target.maxHp,
        alive: sliceState.target.hp > 0,
        awakened: sliceState.target.awakened,
        hitFlash: nowMs <= guardianHitFlashUntilMs,
        telegraphStrength: getTargetTelegraphStrength(sliceState),
      },
    ];

    if (scarabState) {
      enemyStates.push({
        x: scarabState.position.x,
        y: scarabState.position.y,
        z: scarabState.position.z,
        modelScale: 0.62,
        hpRatio: scarabState.maxHp <= 0 ? 0 : scarabState.hp / scarabState.maxHp,
        alive: scarabState.hp > 0,
        awakened: scarabState.awakened,
        hitFlash: nowMs <= scarabHitFlashUntilMs,
        telegraphStrength: getScarabTelegraphStrength(scarabState),
      });
    }

    if (mummyState) {
      enemyStates.push({
        x: mummyState.position.x,
        y: mummyState.position.y,
        z: mummyState.position.z,
        modelScale: 1.15,
        hpRatio: mummyState.maxHp <= 0 ? 0 : mummyState.hp / mummyState.maxHp,
        alive: mummyState.hp > 0,
        awakened: mummyState.runtime.state !== 'SLEEPING',
        hitFlash: nowMs <= mummyHitFlashUntilMs,
        telegraphStrength: getMummyTelegraphStrength(mummyState),
      });
    }

    if (genericEnemyState) {
      enemyStates.push({
        x: genericEnemyState.position.x,
        y: genericEnemyState.position.y,
        z: genericEnemyState.position.z,
        modelScale: genericEnemyState.archetype === 'COBRA' ? 0.9 : 1.15,
        hpRatio: genericEnemyState.def.baseHp <= 0 ? 0 : genericEnemyState.hp / genericEnemyState.def.baseHp,
        alive: genericEnemyState.hp > 0,
        awakened: genericEnemyState.runtime.state !== 'DORMANT',
        hitFlash: false,
        telegraphStrength: getGenericTelegraphStrength(genericEnemyState),
      });
    }

    renderer?.setEnemyStates(enemyStates);
    renderer?.setObjectiveState({
      exitUnlocked: sliceState.exitUnlocked,
      completed: sliceState.completed,
    });
  }

  function syncGuardianEntityState(): void {
    if (!sliceState || !guardianEntitySync) {
      enemyHurtboxes.clear();
      return;
    }

    guardianEntitySync.sync(sliceState.target);
    if (sliceState.target.hp <= 0) {
      enemyHurtboxes.remove(guardianEntitySync.entityId);
      return;
    }

    const existing = enemyHurtboxes.getByEntity(guardianEntitySync.entityId);
    if (existing) {
      enemyHurtboxes.update(
        guardianEntitySync.entityId,
        sliceState.target.position.x,
        sliceState.target.position.y,
        sliceState.target.position.z,
      );
      return;
    }

    enemyHurtboxes.add({
      entityId: guardianEntitySync.entityId,
      centerX: sliceState.target.position.x,
      centerY: sliceState.target.position.y,
      centerZ: sliceState.target.position.z,
      radiusM: GUARDIAN_HURTBOX_RADIUS_M,
      heightM: GUARDIAN_HURTBOX_HEIGHT_M,
    });
  }

  function syncScarabEntityState(): void {
    if (!scarabState) {
      return;
    }

    simulation.world.transform.setPosition(
      scarabState.entityId,
      scarabState.position.x,
      scarabState.position.y,
      scarabState.position.z,
    );
    simulation.world.health.set(scarabState.entityId, scarabState.hp, scarabState.maxHp);

    if (scarabState.hp <= 0) {
      enemyHurtboxes.remove(scarabState.entityId);
      return;
    }

    const existing = enemyHurtboxes.getByEntity(scarabState.entityId);
    if (existing) {
      enemyHurtboxes.update(
        scarabState.entityId,
        scarabState.position.x,
        scarabState.position.y,
        scarabState.position.z,
      );
      return;
    }

    enemyHurtboxes.add({
      entityId: scarabState.entityId,
      centerX: scarabState.position.x,
      centerY: scarabState.position.y,
      centerZ: scarabState.position.z,
      radiusM: SCARAB_HURTBOX_RADIUS_M,
      heightM: SCARAB_HURTBOX_HEIGHT_M,
    });
  }

  function syncMummyEntityState(): void {
    if (!mummyState) {
      return;
    }

    simulation.world.transform.setPosition(
      mummyState.entityId,
      mummyState.position.x,
      mummyState.position.y,
      mummyState.position.z,
    );
    simulation.world.health.set(mummyState.entityId, mummyState.hp, mummyState.maxHp);

    if (mummyState.hp <= 0) {
      enemyHurtboxes.remove(mummyState.entityId);
      return;
    }

    const existing = enemyHurtboxes.getByEntity(mummyState.entityId);
    if (existing) {
      enemyHurtboxes.update(
        mummyState.entityId,
        mummyState.position.x,
        mummyState.position.y,
        mummyState.position.z,
      );
      return;
    }

    enemyHurtboxes.add({
      entityId: mummyState.entityId,
      centerX: mummyState.position.x,
      centerY: mummyState.position.y,
      centerZ: mummyState.position.z,
      radiusM: MUMMY_HURTBOX_RADIUS_M,
      heightM: MUMMY_HURTBOX_HEIGHT_M,
    });
  }

  // G-13: sync ECS del nemico generico (COBRA, SHABTI, PRIEST, SOBEK, ROYAL).
  function syncGenericEnemyEntityState(): void {
    if (!genericEnemyState) {
      return;
    }

    simulation.world.transform.setPosition(
      genericEnemyState.entityId,
      genericEnemyState.position.x,
      genericEnemyState.position.y,
      genericEnemyState.position.z,
    );
    simulation.world.health.set(genericEnemyState.entityId, genericEnemyState.hp, genericEnemyState.def.baseHp);

    if (genericEnemyState.hp <= 0) {
      enemyHurtboxes.remove(genericEnemyState.entityId);
      return;
    }

    const existing = enemyHurtboxes.getByEntity(genericEnemyState.entityId);
    if (existing) {
      enemyHurtboxes.update(
        genericEnemyState.entityId,
        genericEnemyState.position.x,
        genericEnemyState.position.y,
        genericEnemyState.position.z,
      );
      return;
    }

    // Hurtbox proporzionale all'archetipo: piccolo per COBRA, grande per i boss
    const hurtboxRadiusM = genericEnemyState.archetype === 'COBRA' ? 0.3 : 0.55;
    const hurtboxHeightM = genericEnemyState.archetype === 'COBRA' ? 0.7 : 1.75;
    enemyHurtboxes.add({
      entityId: genericEnemyState.entityId,
      centerX: genericEnemyState.position.x,
      centerY: genericEnemyState.position.y,
      centerZ: genericEnemyState.position.z,
      radiusM: hurtboxRadiusM,
      heightM: hurtboxHeightM,
    });
  }

  // C-03: bussola della sorgente sonora rispetto al player (per i sottotitoli).
  // yaw 0 = verso -z; il forward del player in coordinate (x, z) è
  // (−sin(yaw), −cos(yaw)); l'evento dietro ⇒ 'back', avanti ⇒ 'front'.
  function subtitleDirectionTo(x: number, z: number): SubtitleDirection | null {
    if (!playerController) return null;
    const playerPos = playerController.getState().position;
    const dx = x - playerPos.x;
    const dz = z - playerPos.z;
    if (Math.hypot(dx, dz) < 1.5) return null;
    const angleToEvent = Math.atan2(dx, dz);
    const angleForward = Math.atan2(-Math.sin(cameraYaw), -Math.cos(cameraYaw));
    let rel = angleForward - angleToEvent;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    if (Math.abs(rel) < Math.PI / 4) return 'front';
    if (rel > 0) return 'right';
    if (rel < 0) return 'left';
    return 'back';
  }

  function hasRuntimeLineOfSight(
    from: { readonly x: number; readonly y: number; readonly z: number },
    to: { readonly x: number; readonly y: number; readonly z: number },
  ): boolean {
    if (physicsWorld) {
      return physicsWorld.hasLineOfSight(
        { x: from.x, y: from.y + 0.35, z: from.z },
        { x: to.x, y: to.y + 0.35, z: to.z },
      );
    }

    if (guardianRuntime) {
      return guardianRuntime.hasLineOfSightTo(to);
    }

    return true;
  }

  /**
   * Drop oro deterministico per un nemico ucciso: deriva il valore di roll dal
   * seed del piano + EntityId (mai Math.random), così la run resta riproducibile.
   */
  function rollEnemyGoldDrop(tier: 1 | 2 | 3, entityId: number): number {
    const floorSeed = sliceState?.floor.seed ?? 0;
    const rollValue = hash32(floorSeed, entityId) / 0x100000000;
    const base = rollGoldDrop(tier, rollValue);
    // NEW-3: "Fame del Deserto" raddoppia l'oro raccolto
    if (activeCurse?.definition.id === 'fame-del-deserto') {
      return base * 2;
    }
    return base;
  }

  function resolveVerticalSliceAttack(
    attack: AttackDefinition,
    activeStartTick: number,
  ): boolean {
    if (!sliceState || !playerController || !guardianEntitySync || playerEntityId === null) {
      return false;
    }

    const playerState = playerController.getState();
    const hitTargets = collectAttackHits({
      attackerId: playerEntityId,
      attack,
      attackerPose: {
        x: playerState.position.x,
        y: playerState.position.y,
        z: playerState.position.z,
        yaw: cameraYaw,
      },
      hurtboxes: enemyHurtboxes,
      activeStartTick,
      hitRegistry: playerHitRegistry,
      hasLineOfSight: (entry) =>
        hasRuntimeLineOfSight(playerState.position, {
          x: entry.centerX,
          y: entry.centerY,
          z: entry.centerZ,
        }),
    });

    if (hitTargets.length === 0) {
      return false;
    }

    let connected = false;
    // v2: hitmarker differenziale — cattura il crit dell'ultimo colpo a segno
    let lastHitCritical = false;

    for (const targetId of hitTargets) {
      // G-05: danno con modifier dei graft — la guardiana è una MUMMY (undead),
      // lo scarabeo è una bestia (nessun bonus Lapislazzuli).
      const genericUndead = genericEnemyState !== null && genericEnemyState.entityId === targetId &&
        (genericEnemyState.archetype === 'MUMMY' || genericEnemyState.archetype === 'ROYAL_MUMMY');
      const targetIsUndead = targetId === guardianEntitySync.entityId || targetId === mummyState?.entityId || genericUndead;
      const graftDamage = resolvePlayerDamage(attack.damage, combatModifiers, {
        targetIsUndead,
      });
      const outcome = resolveDamage({
        baseDamageHp: graftDamage,
        attackModifier: 1,
        sourceModifier: 1,
        targetArmor: 0,
        resistanceMultiplier: 1,
        isCritical: false,
        criticalMultiplier: 1,
      });
      if (outcome.finalDamageHp <= 0) {
        continue;
      }
      lastHitCritical = outcome.wasCritical;

      if (targetId === guardianEntitySync.entityId) {
        const resolution = applyDamageToSliceTarget(sliceState, outcome.finalDamageHp);
        simulation.world.health.set(targetId, resolution.targetHp, sliceState.target.maxHp);
        guardianHitFlashUntilMs = performance.now() + 140;
        connected = true;

        if (resolution.killed) {
          simulation.events.emit({
            kind: 'ENEMY_DIED',
            entityId: targetId,
            position: sliceState.target.position,
            data: {
              enemy: sliceState.target.name,
              archetype: 'MUMMY',
              attackId: attack.id,
              goldDropped: rollEnemyGoldDrop(1, targetId),
            },
          });
          runStats = { ...runStats, enemiesDefeated: runStats.enemiesDefeated + 1 };
          hud.showMessage('☥ Guardiana abbattuta. Il sigillo cede.', 3200);
        } else {
          hud.showMessage(`Colpo a segno: -${resolution.damageHp} HP`);
        }
      } else if (targetId === scarabState?.entityId) {
        const resolution = applyDamageToScarab(scarabState, outcome.finalDamageHp);
        simulation.world.health.set(targetId, resolution.targetHp, scarabState.maxHp);
        scarabHitFlashUntilMs = performance.now() + 140;
        connected = true;

        if (resolution.killed) {
          simulation.events.emit({
            kind: 'ENEMY_DIED',
            entityId: targetId,
            position: scarabState.position,
            data: {
              enemy: scarabState.name,
              archetype: 'SCARAB',
              attackId: attack.id,
              goldDropped: rollEnemyGoldDrop(1, targetId),
            },
          });
          runStats = { ...runStats, enemiesDefeated: runStats.enemiesDefeated + 1 };
          hud.showMessage('Scarabeo spezzato.', 1800);
        } else {
          hud.showMessage(`Carapace infranto: -${resolution.damageHp} HP`, 1200);
        }
      } else if (targetId === mummyState?.entityId) {
        mummyState.hp = Math.max(0, mummyState.hp - outcome.finalDamageHp);
        simulation.world.health.set(targetId, mummyState.hp, mummyState.maxHp);
        mummyHitFlashUntilMs = performance.now() + 140;
        connected = true;

        if (mummyState.hp <= 0) {
          simulation.events.emit({
            kind: 'ENEMY_DIED',
            entityId: targetId,
            position: mummyState.position,
            data: {
              enemy: mummyState.name,
              archetype: 'MUMMY',
              attackId: attack.id,
              goldDropped: rollEnemyGoldDrop(1, targetId),
            },
          });
          runStats = { ...runStats, enemiesDefeated: runStats.enemiesDefeated + 1 };
          hud.showMessage('Le bende cedono: mummia dissolta.', 1800);
        } else {
          hud.showMessage(`Bende lacerate: -${outcome.finalDamageHp} HP`, 1200);
        }
      } else if (genericEnemyState?.entityId === targetId) {
        const resolution = applyDamageToGenericEnemy(genericEnemyState, outcome.finalDamageHp);
        simulation.world.health.set(targetId, resolution.hp, genericEnemyState.def.baseHp);
        connected = true;

        if (resolution.killed) {
          simulation.events.emit({
            kind: 'ENEMY_DIED',
            entityId: targetId,
            position: genericEnemyState.position,
            data: {
              enemy: genericEnemyState.def.name,
              archetype: genericEnemyState.archetype,
              attackId: attack.id,
              goldDropped: rollEnemyGoldDrop(1, targetId),
            },
          });
          runStats = { ...runStats, enemiesDefeated: runStats.enemiesDefeated + 1 };
          hud.showMessage(`${genericEnemyState.def.name} soccombe.`, 1800);
        } else {
          hud.showMessage(`Colpo a segno: -${outcome.finalDamageHp} HP`, 1200);
        }
      }
    }

    if (!connected) {
      return false;
    }

    // G-18: cue di impatto — crit/hitstop solo su colpi a segno (juice).
    audio.play({ name: 'attack_hit', volume: 0.5 });
    renderer?.addCameraShake(0.14);
    // v2: hitmarker differenziale — oro su colpo (critico = rosso)
    hud.showHitmarker(lastHitCritical ? 'crit' : 'hit');
    // NEW-1: hitstop — 4 tick di pausa del loop fisico (il rendering continua):
    // l'impatto "pesa", come nei migliori FPS roguelike (Hades, DUSK).
    hitstopTicksRemaining = HITSTOP_TICKS;

    syncGuardianEntityState();
    syncScarabEntityState();
    syncMummyEntityState();
    syncVerticalSlicePresentation();
    return true;
  }

  function tryHandleObjectiveInteract(): boolean {
    if (!sliceState || !playerController) return false;
    const playerState = playerController.getState();
    const resolution = tryCompleteSlice(sliceState, playerState.position);

    switch (resolution) {
      case 'LOCKED':
        hud.showMessage('Il sigillo resiste. Abbatti la guardiana.');
        return true;
      case 'COMPLETE':
        renderer?.interactDoor();
        audio.play({ name: 'door_creak', volume: 0.6 });
        simulation.events.emit({
          kind: 'FLOOR_COMPLETE',
          data: {
            floorId: sliceState.floor.floorId,
          },
        });
        hud.showMessage('Uscita raggiunta. Vertical slice completata.', 4000);
        syncVerticalSlicePresentation();
        return true;
      case 'STAIR':
        // G-10: scala verso il piano successivo — discesa con fade.
        renderer?.interactDoor();
        audio.play({ name: 'stair_descend', volume: 0.7 });
        // Tutorial graduale: la discesa introduce i piani più profondi.
        hud.showContextualHint({
          id: 'hint-stair',
          text: 'Scala verso il basso: ogni piano è più buio e più ricco di tesori.',
        });
        simulation.events.emit({
          kind: 'FLOOR_COMPLETE',
          data: {
            floorId: sliceState.floor.floorId,
          },
        });
        void descendToNextFloor();
        return true;
      case 'ALREADY_COMPLETE':
        hud.showMessage('La via è già aperta.');
        return true;
      case 'TOO_FAR':
        return false;
    }

    return false;
  }

  function processInput(_frame: InputFrame): void {
    if (deathOverlay.visible) {
      for (const action of Object.values(ActionKind)) {
        if (_frame.wasPressed(action)) {
          _frame.consume(action);
        }
      }
      return;
    }

    // Movement direction (WASD) - elaborato dai sistemi ECS
    // Qui si logga solo per debug. L'input raw vive in InputFrame.

    if (tutorialShown) {
      const shouldDismissTutorial =
        _frame.wasPressed(ActionKind.Pause) ||
        _frame.isDown(ActionKind.MoveForward) ||
        _frame.isDown(ActionKind.MoveBackward) ||
        _frame.isDown(ActionKind.MoveLeft) ||
        _frame.isDown(ActionKind.MoveRight) ||
        _frame.wasPressed(ActionKind.Attack) ||
        _frame.wasPressed(ActionKind.Interact);
      if (shouldDismissTutorial) {
        hud.hideTutorial();
        tutorialShown = false;
        requestCanvasPointerLock();
      }
      for (const action of Object.values(ActionKind)) {
        if (_frame.wasPressed(action)) {
          _frame.consume(action);
        }
      }
      return;
    }

    // Azioni one-shot: loggate e consumate
    if (_frame.wasPressed(ActionKind.TorchToggle)) {
      runTorchAction('TOGGLE');
      _frame.consume(ActionKind.TorchToggle);
    }
    if (_frame.wasPressed(ActionKind.Interact)) {
      const playerPosition = currentPlayerPosition();
      if (tryPickUpLootReliquary(playerPosition)) {
        _frame.consume(ActionKind.Interact);
      } else if (tryPickUpIntroTorch(playerPosition)) {
        _frame.consume(ActionKind.Interact);
      } else if (tryHandleObjectiveInteract()) {
        _frame.consume(ActionKind.Interact);
      } else if (tryHandleBrazierInteract()) {
        _frame.consume(ActionKind.Interact);
      } else if (playerPosition && isNearDigSite(playerPosition)) {
        hud.showContextualHint({
          id: 'hint-dig',
          text: 'Tieni premuto E per scavare: la sabbia può nascondere tesori e mappe.',
        });
        hud.showMessage(
          torchRuntime.state === 'OFF'
            ? 'Serve una torcia accesa per scavare.'
            : 'Mantieni E per scavare il tesoro sepolto.',
          1600,
        );
        _frame.consume(ActionKind.Interact);
      } else {
        const opened = renderer?.interactDoor();
        if (opened) {
          hud.showMessage('🚪 Porta aperta');
        } else {
          log.info('Interact (nessuna porta vicina)');
        }
        _frame.consume(ActionKind.Interact);
      }
    }
    if (_frame.wasPressed(ActionKind.Dodge)) {
      log.info('Dodge');
      // G-18: cue di schivata sintetico.
      audio.play({ name: 'player_dodge', volume: 0.45 });
      // Tutorial graduale: la schivata è lo strumento difensivo di base.
      hud.showContextualHint({
        id: 'hint-dodge',
        text: 'Schivata (Spazio): breve scatto laterale per evitare i colpi in arrivo.',
      });
      // Passo di Bastet: i-frame nella parte centrale della schivata.
      if (runtimeBonuses.hasDodgeIFrames) {
        dodgeIFramesUntilMs = performance.now() + DODGE_IFRAME_MS;
        hud.showMessage('Passo di Bastet: scatto intangibile.', 900);
      }
      _frame.consume(ActionKind.Dodge);
    }
    if (_frame.wasPressed(ActionKind.Parry)) {
      // Parry system: apre la finestra di parata (350ms). Se un attacco
      // parabile colpisce in finestra e il nemico è davanti, il danno viene
      // annullato e il nemico stordito (punish window). Il suono di guardia
      // è lo stesso whoosh della schivata; il successo usa 'parry_success'.
      log.info('Parry: guardia alzata');
      parryWindowUntilMs = performance.now() + PARRY_WINDOW_MS;
      parryIFramesUntilMs = performance.now() + PARRY_IFRAME_MS;
      audio.play({ name: 'player_dodge', volume: 0.35 });
      renderer?.playWeaponParry();
      _frame.consume(ActionKind.Parry);
    }
    if (config.accessibility.sprintToggle && _frame.wasPressed(ActionKind.Sprint)) {
      const sprintEnabled = toggleSprintLatch(accessibilityToggleRuntime, true);
      hud.showMessage(
        sprintEnabled ? 'Scatto toggle attivo.' : 'Scatto toggle disattivato.',
        1200,
      );
      _frame.consume(ActionKind.Sprint);
    }
    if (_frame.wasPressed(ActionKind.Attack)) {
      const attack = currentWeapon().attacks[0];
      if (attack) {
        startAttack(playerCombatState, attack);
        // Viewmodel arma 3D: fendente visibile in mano.
        renderer?.playWeaponSwing();
        // G-15: scintille sul colpo — feedback visivo immediato dell'azione.
        const playerPosition = currentPlayerPosition();
        if (playerPosition && renderer) {
          renderer.emitSparks(
            {
              x: playerPosition.x,
              y: playerPosition.y + 0.8,
              z: playerPosition.z,
            },
            0xffd27a,
            config.accessibility.reduceParticleEffects ? 3 : 10,
          );
          // G-15 V2: falce luminosa lungo la direzione della visuale.
          renderer.playWeaponTrail(playerPosition, cameraYaw);
        }
        // G-18: cue d'arma sintetico (fendente).
        audio.play({ name: 'attack_swing', volume: 0.5 });
      }
      _frame.consume(ActionKind.Attack);
    }
    if (_frame.wasPressed(ActionKind.TorchWave)) {
      runTorchAction('WAVE');
      _frame.consume(ActionKind.TorchWave);
    }
    if (_frame.wasPressed(ActionKind.TorchPlace)) {
      const playerPosition = currentPlayerPosition();
      if (torchRuntime.state === 'PLACED' && playerPosition && !isNearPlacedTorch(playerPosition)) {
        hud.showMessage('Avvicinati alla torcia posata per raccoglierla.', 1800);
      } else {
        const previousState = torchRuntime.state;
        const resolved = runTorchAction('PLACE_OR_PICK_UP');
        if (resolved.result.changed && playerPosition) {
          if (resolved.result.runtime.state === 'PLACED') {
            placedTorchPosition = {
              x: playerPosition.x,
              y: 0.02,
              z: playerPosition.z,
            };
          } else if (previousState === 'PLACED') {
            placedTorchPosition = null;
          }
          syncWorldInteractables();
        }
      }
      _frame.consume(ActionKind.TorchPlace);
    }
    if (_frame.wasPressed(ActionKind.KaEcho)) {
      runTorchAction('KA_ECHO', 2200);
      _frame.consume(ActionKind.KaEcho);
    }
    if (_frame.wasPressed(ActionKind.Map)) {
      if (progressionOverlay.visible) {
        resumeFromProgressionOverlay();
      } else if (!settingsMenu.visible) {
        localPause('manual');
        progressionOverlay.show(buildProgressionOverlayData());
      }
      _frame.consume(ActionKind.Map);
    }
    if (_frame.wasPressed(ActionKind.Pause)) {
      if (progressionOverlay.visible) {
        resumeFromProgressionOverlay();
      } else if (settingsMenu.visible) {
        resumeFromSettings();
      } else {
        localPause('manual');
        settingsMenu.show(buildRuntimeSettings());
      }
      _frame.consume(ActionKind.Pause);
    }
    if (_frame.wasPressed(ActionKind.DebugOverlay)) {
      // Debug overlay (v2): profiling in-game con F3/Backquote
      debugOverlay.toggle();
      _frame.consume(ActionKind.DebugOverlay);
    }

    // Weapon switching
    if (_frame.wasPressed(ActionKind.WeaponSlot1)) {
      currentWeaponIndex = 0;
      weaponName = currentWeapon().name;
      renderer?.setWeaponViewmodelVisible(false);
      _frame.consume(ActionKind.WeaponSlot1);
    }
    if (_frame.wasPressed(ActionKind.WeaponSlot2)) {
      currentWeaponIndex = 1;
      weaponName = currentWeapon().name;
      renderer?.setWeaponViewmodelVisible(true);
      _frame.consume(ActionKind.WeaponSlot2);
    }
    if (_frame.wasPressed(ActionKind.WeaponSlot3) && isWeaponUnlocked(2)) {
      currentWeaponIndex = 2;
      weaponName = currentWeapon().name;
      renderer?.setWeaponViewmodelVisible(false);
      _frame.consume(ActionKind.WeaponSlot3);
    }

  }

  function updateHUD(): void {
    const playerHealth = currentPlayerHealth();
    const playerPosition = currentPlayerPosition();
    const digProgressSuffix =
      digSite && !digSite.completed
        ? ` · scavo ${Math.round(getDigProgress(digSite) * 100)}%`
        : '';
    const revealedRoomsSuffix =
      runtimeGameplayState.revealedRoomIds.length > 0
        ? ` · stanze rivelate ${runtimeGameplayState.revealedRoomIds.length}`
        : '';

    hud.update({
      hp: playerHealth?.hp ?? playerMaxHp,
      maxHp: playerHealth?.maxHp ?? playerMaxHp,
      torchFuelSeconds: torchRuntime.fuelSeconds,
      torchCapacitySeconds: torchRuntime.capacitySeconds,
      torchLit,
      torchPlaced,
      darkness: runtimeGameplayState.darknessLevel,
      weaponName,
      weaponSlots: buildWeaponSlotLabels(),
      currentWeaponSlot: currentWeaponIndex,
      objectiveText: sliceState ? getObjectiveText(sliceState) : 'Allineamento del piano in corso...',
      progressText: sliceState ? getTargetHudText(sliceState) : 'Generazione necropoli...',
      floorText: `${currentFloorIndex > 1 ? `Piano ${currentFloorIndex} · ` : ''}${sliceState?.floorSummary ?? 'Fallback scena deterministica pronta'}${digProgressSuffix}${revealedRoomsSuffix}${runtimeGameplayState.goldCoins > 0 ? ` · oro ${runtimeGameplayState.goldCoins}` : ''}${saveData ? ` · frammenti ${saveData.payload.fragments}` : ''}`,
      minimap: sliceState
        ? buildRuntimeMinimap({
          layout: sliceState.sceneLayout,
          revealedRoomIds: runtimeGameplayState.revealedRoomIds,
          playerPosition: playerPosition
            ? { x: playerPosition.x, z: playerPosition.z }
            : null,
          mapRoomId: Number(sliceState.floor.mapRoomId),
        })
        : null,
    });

    // G-15: respiro del buio — si intensifica con la darkness accumulata e
    // diventa totale quando la torcia è spenta. Bordo porpora a HP ≤ 30%.
    if (cinematicOverlay) {
      const breathIntensity = torchLit
        ? Math.min(0.35, runtimeGameplayState.darknessLevel * 0.45)
        : 1.0;
      cinematicOverlay.setDarknessBreath(breathIntensity);
      const currentHp = playerHealth?.hp ?? playerMaxHp;
      cinematicOverlay.setLowHp(currentHp <= playerMaxHp * 0.3);
    }
    // G-18: drone ambientale pilotato dalla stessa darkness (audio del buio).
    audio.setAmbienceLevel(
      torchLit
        ? Math.min(0.45, runtimeGameplayState.darknessLevel * 0.55)
        : 1.0,
    );
  }

  function loop(timestampMs: number): void {
    if (state !== 'running') return;

    const deltaMs = lastTimeMs === 0 ? clock.tickDurationMs : timestampMs - lastTimeMs;
    lastTimeMs = timestampMs;

    // Monitor frame time per adaptive quality
    frameTimeAccum += deltaMs;
    frameCount++;
    if (frameCount >= 60) {
      quality.adaptTo(frameTimeAccum / frameCount);
      frameTimeAccum = 0;
      frameCount = 0;
      // QC-1: se il tier è cambiato, riapplica il profilo al renderer
      if (renderer) {
        renderer.applyQualityProfile(quality.profile);
      }
    }

    // Process input
    input.beginFrame();
    processInput(input.frame);
    const frameEvents: DomainEvent[] = [];
    drainPendingFrameEvents(frameEvents);

    // Mouse-look: accumulato una volta per frame di rendering (non per tick
    // fisso di simulazione, altrimenti la sensibilità dipenderebbe dal
    // numero di step fissi eseguiti in questo frame).
    if (document.pointerLockElement) {
      const sens = 0.002 * config.controls.mouseSensitivity;
      const pitchDirection = config.controls.invertY ? 1 : -1;
      // G-18 V3: smoothing esponenziale — il delta grezzo alimenta un filtro
      // (alpha = 1 - smoothing), la rotazione usa la velocità filtrata.
      const smoothing = Math.max(0, Math.min(0.95, config.controls.mouseSmoothing));
      const alpha = 1 - smoothing;
      const rawYaw = input.frame.mouseDeltaX * sens;
      const rawPitch = input.frame.mouseDeltaY * sens * pitchDirection;
      lookYawFiltered += (rawYaw - lookYawFiltered) * alpha;
      lookPitchFiltered += (rawPitch - lookPitchFiltered) * alpha;
      cameraYaw -= lookYawFiltered;
      cameraPitch += lookPitchFiltered;
      cameraPitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraPitch));
    }

    // Simulate
    const stepPlan = clock.update(deltaMs);
    // NEW-1: hitstop — se attivo, salta i passi di simulazione (il rendering
    // continua): il mondo "congela" per 4 tick dopo il colpo a segno.
    const simulationSteps = hitstopTicksRemaining > 0
      ? 0
      : stepPlan.steps;
    if (hitstopTicksRemaining > 0) {
      hitstopTicksRemaining--;
    }
    for (let i = 0; i < simulationSteps; i++) {
      if (sliceState) {
        guardianRuntime?.syncPosition(sliceState.target.position);
        syncGuardianEntityState();
        syncScarabEntityState();
      }
      simulation.step(stepPlan.tickStart + i, clock.tickDurationMs);
      const previousPhase = playerCombatState.phase;
      const currentPhase = tickCombatState(playerCombatState, stepPlan.tickStart + i);
      if (
        previousPhase !== 'ACTIVE' &&
        currentPhase === 'ACTIVE' &&
        playerCombatState.currentAttack
      ) {
        playerAttackActiveStartTick = stepPlan.tickStart + i;
        playerAttackConnectedThisSwing = false;
        playerHitRegistry.clear();
      }
      if (
        currentPhase === 'ACTIVE' &&
        playerCombatState.currentAttack &&
        playerAttackActiveStartTick !== null
      ) {
        playerAttackConnectedThisSwing ||= resolveVerticalSliceAttack(
          playerCombatState.currentAttack,
          playerAttackActiveStartTick,
        );
      }
      if (previousPhase === 'ACTIVE' && currentPhase === 'RECOVERY') {
        if (!playerAttackConnectedThisSwing) {
          hud.showMessage('Il colpo va a vuoto', 1200);
        }
        playerAttackActiveStartTick = null;
        playerAttackConnectedThisSwing = false;
        playerHitRegistry.clear();
      }
      // Tick torcia (consuma carburante se accesa)
      const previousTorchRuntime = torchRuntime;
      const tickResult = tickTorch(torchRuntime);
      torchRuntime = tickResult.runtime;
      emitTorchRuntimeEvents(previousTorchRuntime, tickResult);
      syncTorchPresentation();
      // Tick del Director: decrementa il grace period post-wipe (G-03).
      enemySpawnDirector?.tick();
      if (sliceState && playerController && !sliceState.completed && !sliceState.failed) {
        const playerState = playerController.getState();
        // G-18: passi sulla sabbia — rate-limit 0.45s, solo se in movimento
        const horizontalSpeed = Math.hypot(playerState.velocity.x, playerState.velocity.z);
        if (playerState.grounded && horizontalSpeed > 0.6) {
          footstepCooldownMs -= clock.tickDurationMs;
          if (footstepCooldownMs <= 0) {
            audio.play({ name: 'footstep_sand', volume: 0.5 });
            // G-18: polvere di sabbia sotto i piedi (feedback visivo del passo)
            renderer?.emitSparks(
              {
                x: playerState.position.x,
                y: playerState.position.y - 0.55,
                z: playerState.position.z,
              },
              0x8a7350,
              config.accessibility.reduceParticleEffects ? 1 : 3,
            );
            footstepCooldownMs = 450;
          }
        }
        if (digSite && !digSite.completed && input.frame.isDown(ActionKind.Interact) && isNearDigSite(playerState.position)) {
          const digEvent = tickDig(digSite, torchRuntime.state !== 'OFF');
          if (digEvent) {
            emitDigEvents(simulation.events, digEvent, {
              x: digSite.positionX,
              y: 0.02,
              z: digSite.positionZ,
            });
          }
        }
        const enemyTick = tickVerticalSlice(sliceState, playerState.position, 1 / TICK_HZ);
        const canEnemyHitPlayer =
          enemyTick.playerDamageHp <= 0 ||
          hasRuntimeLineOfSight(sliceState.target.position, playerState.position);
        const resolvedEnemyDamageHp = canEnemyHitPlayer ? enemyTick.playerDamageHp : 0;
        const resolvedEnemyMessage =
          !canEnemyHitPlayer && enemyTick.playerDamageHp > 0
            ? 'Il colpo del guardiano si spezza sul muro.'
            : enemyTick.message;

        if (resolvedEnemyMessage) {
          hud.showMessage(resolvedEnemyMessage, resolvedEnemyDamageHp > 0 ? 1900 : 1500);
        }
        if (resolvedEnemyDamageHp > 0) {
          const appliedDamageHp = applyDamageToPlayer(
            resolvedEnemyDamageHp,
            playerState.position,
            sliceState.target.name,
          );
          if ((currentPlayerHealth()?.hp ?? 0) <= 0 && appliedDamageHp > 0) {
            markSliceFailed(sliceState);
            hud.showMessage('Sei stato abbattuto nella cripta.', 3200);
          }
        }
        if (scarabState && scarabState.hp > 0) {
          const scarabTick = tickScarabEncounter(scarabState, {
            playerPosition: playerState.position,
            deltaSeconds: 1 / TICK_HZ,
            hasLineOfSight: hasRuntimeLineOfSight(scarabState.position, playerState.position),
            torchAttractor: placedTorchPosition,
            noiseAttractor: runtimeStimulusState.activeStimulus?.position ?? null,
          });
          if (scarabTick.message) {
            hud.showMessage(scarabTick.message, scarabTick.playerDamageHp > 0 ? 1800 : 1300);
          }
          if (scarabTick.playerDamageHp > 0) {
            const appliedDamageHp = applyDamageToPlayer(
              scarabTick.playerDamageHp,
              playerState.position,
              scarabState.name,
            );
            if ((currentPlayerHealth()?.hp ?? 0) <= 0 && appliedDamageHp > 0) {
              markSliceFailed(sliceState);
              hud.showMessage('Lo sciame ti ha travolto nella cripta.', 3200);
            }
          }
          syncScarabEntityState();
        }

        if (mummyState && mummyState.hp > 0) {
          const mummyTick = tickMummyEncounter(mummyState, {
            playerPosition: playerState.position,
            playerYaw: cameraYaw,
            deltaSeconds: 1 / TICK_HZ,
            hasLineOfSight: hasRuntimeLineOfSight(mummyState.position, playerState.position),
            torchLitNearby: torchRuntime.state === 'HIGH' || torchRuntime.state === 'LOW',
            tick: clock.currentTick,
            parryWindowActive: parryWindowActive(parryWindowUntilMs, performance.now()),
          });
          if (mummyTick.parried) {
            audio.play({ name: 'parry_success', volume: 0.7 });
            renderer?.addCameraShake(0.3);
            hud.showHitmarker('hit');
            hud.showMessage('Parata perfetta! La mummia è stordita — colpisci ora.', 1600);
            hud.showContextualHint({
              id: 'hint-parry',
              text: 'Parata riuscita: il nemico stordito non risponde — CLICK SX per colpirlo.',
            });
          }
          if (mummyTick.message) {
            hud.showMessage(mummyTick.message, mummyTick.playerDamageHp > 0 ? 1800 : 1300);
          }
          if (mummyTick.playerDamageHp > 0) {
            const appliedDamageHp = applyDamageToPlayer(
              mummyTick.playerDamageHp,
              playerState.position,
              mummyState.name,
            );
            if ((currentPlayerHealth()?.hp ?? 0) <= 0 && appliedDamageHp > 0) {
              markSliceFailed(sliceState);
              hud.showMessage('Il fendente ti ha falciato nella cripta.', 3200);
            }
          }
          syncMummyEntityState();
        }

        if (genericEnemyState && isGenericEnemyAlive(genericEnemyState)) {
          const genericPosition = genericEnemyState.position;
          const genericTick = tickGenericEncounter(genericEnemyState, {
            playerPosition: playerState.position,
            playerYaw: cameraYaw,
            tick: clock.currentTick,
            hasLineOfSight: () =>
              hasRuntimeLineOfSight(genericPosition, playerState.position),
            torchLit: torchRuntime.state === 'HIGH' || torchRuntime.state === 'LOW',
            parryWindowActive: parryWindowActive(parryWindowUntilMs, performance.now()),
            // A-01: consumatore AI generalizzato del rumore — NOISE_PULSE e
            // KA_ECHO_PULSE svegliano/attirano QUALSIASI archetipo (non solo
            // lo scarabeo), amplificando il raggio di wake.
            noiseStimulus: runtimeStimulusState.activeStimulus
              ? {
                  x: runtimeStimulusState.activeStimulus.position.x,
                  z: runtimeStimulusState.activeStimulus.position.z,
                  intensity: runtimeStimulusState.activeStimulus.intensity,
                }
              : null,
          });
          if (genericTick.parried) {
            audio.play({ name: 'parry_success', volume: 0.7 });
            renderer?.addCameraShake(0.3);
            hud.showHitmarker('hit');
            hud.showMessage(
              `Parata perfetta! ${genericEnemyState.def.name} è stordito — colpisci ora.`,
              1600,
            );
            hud.showContextualHint({
              id: 'hint-parry',
              text: 'Parata riuscita: il nemico stordito non risponde — CLICK SX per colpirlo.',
            });
          }
          if (genericTick.message) {
            hud.showMessage(genericTick.message, genericTick.playerDamageHp > 0 ? 1800 : 1300);
          }
          if (genericTick.playerDamageHp > 0) {
            const appliedDamageHp = applyDamageToPlayer(
              genericTick.playerDamageHp,
              playerState.position,
              genericEnemyState.def.name,
            );
            if ((currentPlayerHealth()?.hp ?? 0) <= 0 && appliedDamageHp > 0) {
              markSliceFailed(sliceState);
              hud.showMessage(`${genericEnemyState.def.name} ti ha abbattuto.`, 3200);
            }
          }
          syncGenericEnemyEntityState();
        }

        // G-19: musica adattiva — lo stato deriva dai nemici vivi.
        updateMusicState();

        // Follow-up dinamico (G-03): un nemico morto → il Director pianifica il
        // prossimo incontro finché il budget del piano lo consente. Ogni slot
        // (scarab/mummy/generic) è indipendente: lo spawn usa lo slot libero.
        // (Il blocco esterno garantisce già !sliceState.completed.)
        const scarabDead = scarabState !== null && scarabState.hp <= 0;
        const mummyDead = mummyState !== null && mummyState.hp <= 0;
        const genericDead = genericEnemyState !== null && !isGenericEnemyAlive(genericEnemyState);
        if (scarabDead || mummyDead || genericDead) {
          const followUp = enemySpawnDirector?.planNext() ?? null;
          if (followUp?.enemyType === 'SCARAB') {
            const followUpEntityId = simulation.world.createEntity();
            scarabState = createScarabEncounterState(followUpEntityId, followUp.position);
            log.info('Director: follow-up scarabeo pianificato', {
              roomId: followUp.roomId,
              budgetRemaining: followUp.budgetRemaining,
            });
            hud.showMessage('La sabbia si muove: un altro scarabeo emerge.', 2400);
            if (mummyDead) mummyState = null;
            if (genericDead) genericEnemyState = null;
          } else if (followUp?.enemyType === 'MUMMY') {
            const followUpEntityId = simulation.world.createEntity();
            mummyState = createMummyEncounterState(followUpEntityId, followUp.position);
            log.info('Director: follow-up mummia materializzato', {
              roomId: followUp.roomId,
              budgetRemaining: followUp.budgetRemaining,
            });
            hud.showMessage('Un sarcofago si apre: una mummia emerge.', 2400);
            if (scarabDead) scarabState = null;
            if (genericDead) genericEnemyState = null;
          } else if (followUp) {
            // G-13: QUALSIASI altro archetipo (COBRA, SHABTI, PRIEST,
            // SOBEK_SPAWN, ROYAL_MUMMY) → runtime data-driven generico.
            const followUpEntityId = simulation.world.createEntity();
            genericEnemyState = createGenericEncounterState(
              followUpEntityId,
              followUp.enemyType as import('@/content/enemies.js').EnemyArchetype,
              followUp.position,
            );
            log.info('Director: follow-up archetipo materializzato', {
              enemyType: followUp.enemyType,
              roomId: followUp.roomId,
            });
            hud.showMessage('Le ombre della cripta si condensano in una forma minacciosa.', 2400);
            if (scarabDead) {
              scarabState = null;
            }
            if (mummyDead) {
              mummyState = null;
            }
          } else {
            log.info('Director: budget esaurito, nessun follow-up');
            if (scarabDead) {
              scarabState = null;
            }
            if (mummyDead) {
              mummyState = null;
            }
            if (genericDead) {
              genericEnemyState = null;
            }
          }
          syncScarabEntityState();
          syncMummyEntityState();
        }
        runtimeStimulusState = tickRuntimeStimulusState(runtimeStimulusState);
        guardianRuntime?.syncPosition(sliceState.target.position);
        syncGuardianEntityState();
      }
      frameEvents.push(...simulation.events.flush());
    }

    // Rifletti sulla camera la posa calcolata dal player controller Rapier
    // (G-01: il renderer non calcola più movimento/collisioni da solo).
    if (playerController) {
      const playerState = playerController.getState();
      if (introCinematicUntilMs > timestampMs && introTorchPosition) {
        // G-18 V3: posa panoramica dell'intro — camera rialzata che inquadra
        // la torcia posata, con un pan dolce sinusoidale e leggero zoom.
        const t = (timestampMs - (introCinematicUntilMs - 3200)) * 0.001;
        const panX = Math.sin(t * 0.35) * 0.9;
        const panZ = Math.cos(t * 0.28) * 0.5;
        renderer?.setCameraPose(
          introTorchPosition.x - 3.6 + panX,
          introTorchPosition.y + 2.3,
          introTorchPosition.z + 3.1 + panZ,
          Math.atan2(
            introTorchPosition.x - (introTorchPosition.x - 3.6 + panX),
            introTorchPosition.z - (introTorchPosition.z + 3.1 + panZ),
          ),
          0.18,
        );
        syncAudioListener();
      } else {
        renderer?.setCameraPose(
          playerState.position.x,
          playerState.position.y + EYE_HEIGHT_OFFSET_M,
          playerState.position.z,
          cameraYaw,
          cameraPitch,
        );
        syncAudioListener();
      }

      // NEW-2: crosshair dinamica — sprint/salto espande, crouch/fermo stringe.
      const horizontalSpeed = Math.hypot(playerState.velocity.x, playerState.velocity.z);
      const speedFactor = Math.min(1, horizontalSpeed / 4.5);
      const jumpFactor = playerState.grounded ? 0 : 0.7;
      const crouchFactor = playerState.crouching ? -0.4 : 0;
      const spread = Math.max(0, Math.min(1, speedFactor * 0.6 + jumpFactor + crouchFactor));
      hud.setCrosshairSpread(spread);
    }

    syncVerticalSlicePresentation(timestampMs);
    handleFrameEvents(frameEvents);

    // Update HUD ogni frame
    updateHUD();

    // Debug overlay (v2): metriche live (solo se visibile — zero costo altrimenti)
    if (debugOverlay.visible) {
      const stats = renderer?.getDebugStats() ?? { drawCalls: 0, triangles: 0, memoryMB: 0 };
      const frameMs = deltaMs;
      debugOverlay.update({
        fps: frameMs > 0 ? Math.round(1000 / frameMs) : 0,
        frameMs,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        memoryMB: stats.memoryMB,
        entityCount: simulation.world.entityCount,
        floorSeed: sliceState?.floor.seed ?? 0,
        floorIndex: currentFloorIndex,
        qualityTier: quality.profile.tier,
        version: 'v0.1.0',
        renderBackend: backend,
      });
    }

    // Render
    renderer?.render(deltaMs);

    rafId = requestAnimationFrame(loop);
  }

  return {
    config, clock, simulation, log,
    input, hud, settingsMenu,

    get actionMap(): ActionMap { return actionMap; },

    get state(): AppState { return state; },

    async init(canvas: HTMLCanvasElement): Promise<void> {
      if (state !== 'uninitialized') {
        log.warn('init chiamato su stato non valido', { state });
        return;
      }

      state = 'initializing';
      log.info('Inizializzazione GameApplication', { backend });

      onStatus?.('Caricamento profilo...');
      try {
        saveManager = createSaveManager();
        saveData = await saveManager.load();
        applyRuntimeSettings(readSavedRuntimeSettings(saveData, buildRuntimeSettings()));
        syncProgressionRuntimeBonuses();
      } catch (err) {
        log.warn('Profilo non disponibile, continuo con le impostazioni di default', {
          error: String(err),
        });
        saveManager?.dispose();
        saveManager = null;
        saveData = null;
      }

      // Generation worker
      try {
        onStatus?.('Preparazione generazione run...');
        const worker = new Worker(
          new URL('@/workers/generation.worker.ts', import.meta.url),
          { type: 'module' },
        );
        const { createGenerationClient } = await runtimeModules.generationClient;
        generationClient = createGenerationClient(worker);
        log.info('Generation worker avviato');
      } catch (err) {
        log.warn('Worker non disponibile, generazione in main thread', { error: String(err) });
      }

      onStatus?.('Generazione piano e obiettivo...');
      sliceState = await generateFloorWithFallback();
      enemySpawnDirector = createEnemySpawnDirector({
        sceneLayout: sliceState.sceneLayout,
        entryRoomId: sliceState.floor.entryRoomId,
        floorSeed: sliceState.floor.seed,
        floorIndex: VERTICAL_SLICE_GENERATION_INPUT.floorIndex,
        currentFuelSeconds: torchRuntime.fuelSeconds,
        metaNodes: saveData?.payload.kaNodes.length ?? 0,
        hadWipeThisFloor: false,
      });
      const encounterPlan = enemySpawnDirector.planNext();
      // Il vertical slice materializza solo SCARAB (runtime ECS dedicato).
      // Gli altri archetipi pianificati dal Director restano per l'EnemySpawnSystem (G-03).
      if (encounterPlan?.enemyType === 'SCARAB') {
        const scarabEntityId = simulation.world.createEntity();
        scarabState = createScarabEncounterState(scarabEntityId, encounterPlan.position);
        log.info('Scarab encounter pianificata dal Director', {
          roomId: encounterPlan.roomId,
          distanceToPlayerM: encounterPlan.distanceToPlayerM,
          budgetRemaining: encounterPlan.budgetRemaining,
        });
      } else if (encounterPlan) {
        log.info('Incontro iniziale pianificato dal Director (archetipo riservato a G-03)', {
          enemyType: encounterPlan.enemyType,
          roomId: encounterPlan.roomId,
          distanceToPlayerM: encounterPlan.distanceToPlayerM,
        });
      } else {
        log.info('Director: nessuno spawn iniziale per questo piano');
      }
      brazierStates = sliceState.sceneLayout.braziers.map((brazier) =>
        createBrazier(brazier.brazierId, Number(brazier.roomId)),
      );
      digSite = sliceState.sceneLayout.digSite
        ? createDigSite(
          sliceState.sceneLayout.digSite.siteId,
          Number(sliceState.sceneLayout.digSite.roomId),
          sliceState.sceneLayout.digSite.position.x,
          sliceState.sceneLayout.digSite.position.z,
        )
        : null;

      // Fisica (Rapier WASM) — caricata dopo la generazione del floor per
      // spostare il costo pesante più vicino al momento in cui serve davvero.
      try {
        onStatus?.('Caricamento runtime fisico...');
        const { createPhysicsWorld } = await runtimeModules.physicsWorld;
        physicsWorld = await createPhysicsWorld();
        const { createSliceGuardianRuntime } = await runtimeModules.guardianRuntime;
        guardianRuntime = createSliceGuardianRuntime(
          physicsWorld,
          sliceState.target.position,
          { radiusM: 0.45, heightM: 1.8 },
        );
        guardianEntitySync = createSliceGuardianEntitySync(simulation.world, sliceState.target);
        log.info('PhysicsWorld inizializzato');
      } catch (err) {
        log.error('PhysicsWorld init fallito', { error: String(err) });
        throw err;
      }

      try {
        onStatus?.('Caricamento renderer...');
        const { createThreeRenderer } = await runtimeModules.renderer;
        renderer = createThreeRenderer(backend, canvas, physicsWorld);
        await renderer.init();
        installPointerLockListeners();
        renderer.setFloorLayout(sliceState.sceneLayout);
        // QC-1: applica subito il profilo di qualità iniziale
        renderer.applyQualityProfile(quality.profile);
        syncWorldInteractables();
        syncTorchPresentation();
        syncViewportSize(canvas);
        applyPresentationSettings();
        syncPointerLockState();
        syncVerticalSlicePresentation();
        log.info('Renderer inizializzato', { backend: renderer.backend });
      } catch (err) {
        log.error('Renderer init fallito', { error: String(err) });
        throw err;
      }

      // Player: entità ECS + character controller Rapier + sistemi schedulati.
      onStatus?.('Spawn del giocatore...');
      playerEntityId = simulation.world.createEntity();
      simulation.world.health.set(playerEntityId, playerMaxHp, playerMaxHp);
      const startY = PLAYER.capsuleHeightM / 2 + 0.05;
      const [
        { PlayerCharacterController },
        { createPlayerSystem },
        { createPhysicsSystem },
      ] = await runtimeModules.playerRuntimeModules;
      playerController = new PlayerCharacterController(
        physicsWorld.raw,
        sliceState.sceneLayout.entrySpawn.x,
        startY,
        sliceState.sceneLayout.entrySpawn.z,
      );
      // G-18 V4: doorway snap assist — centri delle aperture del piano
      playerController.setDoorways(
        sliceState.sceneLayout.doorways.map((doorway) => ({
          x: doorway.center.x,
          z: doorway.center.z,
        })),
      );

      const inputSource: InputSource = {
        poll(): PlayerInput {
          const f = input.frame;
          const moveZ =
            (f.isDown(ActionKind.MoveForward) ? 1 : 0) -
            (f.isDown(ActionKind.MoveBackward) ? 1 : 0);
          const moveX =
            (f.isDown(ActionKind.MoveRight) ? 1 : 0) -
            (f.isDown(ActionKind.MoveLeft) ? 1 : 0);
          return {
            moveX,
            moveZ,
            jump: f.wasPressed(ActionKind.Jump),
            sprint: isSprintActive(
              accessibilityToggleRuntime,
              config.accessibility.sprintToggle,
              f.isDown(ActionKind.Sprint),
            ),
            crouch: f.isDown(ActionKind.Crouch),
            yaw: cameraYaw,
            pitch: cameraPitch,
          };
        },
      };

      simulation.scheduler.register(
        createPlayerSystem({
          world: simulation.world,
          controller: playerController,
          playerEntityId,
          inputSource,
        }),
      );
      simulation.scheduler.register(createPhysicsSystem(physicsWorld));

      // Input system: attach to canvas
      onStatus?.('Collegamento controlli...');
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-label', 'Canvas di gioco La Piramide Perduta');
      input.attach(canvas);
      installViewportListeners(canvas);

      // HUD: monta nel parent del canvas
      const parent = canvas.parentElement;
      if (parent) {
        hud.mount(parent);
        settingsMenu.mount(parent);
        progressionOverlay.mount(parent);
        deathOverlay.mount(parent);
        debugOverlay.mount(parent);
        mainMenu = createMainMenu();
        mainMenu.mount(parent);
      }
      applyRuntimeSettings(buildRuntimeSettings());
      persistRuntimeSettings();
      updateHUD();
      hud.showMessage(`Guardiano tracciato: ${sliceState.target.name}`, 2800);

      // Il tutorial appare dopo il click su "INIZIA LA DISCESA" (menu principale),
      // non all'avvio: prima l'utente vede il menu e sceglie.
      hud.onTutorialDismiss = () => {
        tutorialShown = false;
        unlockAudio();
        requestCanvasPointerLock();
      };

      // Settings menu callbacks
      settingsMenu.onApply = (settings: RuntimeSettings) => {
        applyRuntimeSettings(settings);
        persistRuntimeSettings();
        log.info('Impostazioni runtime applicate', { settings });
        resumeFromSettings();
      };
      settingsMenu.onClose = () => {
        resumeFromSettings();
      };
      progressionOverlay.onClose = () => {
        resumeFromProgressionOverlay();
      };
      progressionOverlay.onPurchaseNode = (nodeId: string) => {
        if (!saveData) {
          hud.showMessage('Profilo non disponibile: impossibile spendere Frammenti.', 2200);
          return;
        }

        const result = purchaseKaNode(saveData, nodeId);
        if (!result.changed) {
          hud.showMessage('Nodo non acquistabile.', 1600);
          refreshProgressionOverlay();
          return;
        }

        saveData = result.save;
        syncProgressionRuntimeBonuses();
        void persistProfile(`acquisto nodo Ka ${nodeId}`);
        refreshProgressionOverlay();
        updateHUD();
        const purchasedNodeName = KA_TREE.find((node) => node.id === nodeId)?.name ?? nodeId;
        hud.showMessage(
          `Nodo Ka acquisito: ${purchasedNodeName} lv.${result.newLevel}`,
          2200,
        );
      };
      progressionOverlay.applyPresentation({
        textScale: config.accessibility.textScale,
        highContrast: config.accessibility.highContrast,
        colorBlindMode: config.accessibility.colorBlindMode,
      });
      deathOverlay.onRetry = () => {
        window.location.reload();
      };
      deathOverlay.applyPresentation({
        textScale: config.accessibility.textScale,
        highContrast: config.accessibility.highContrast,
        colorBlindMode: config.accessibility.colorBlindMode,
      });

      // Main menu callbacks: il gioco parte in pausa col menu visibile.
      if (mainMenu) {
        mainMenu.applyPresentation({
          textScale: config.accessibility.textScale,
          highContrast: config.accessibility.highContrast,
          colorBlindMode: config.accessibility.colorBlindMode,
        });
        mainMenu.onStartRun = () => {
          audio.play({ name: 'ui_click', volume: 0.4 });
          mainMenu?.hide();
          localResume('menu');
          unlockAudio();
          requestCanvasPointerLock();
          // G-18 V3: intro con prospettiva della stanza + torcia da raccogliere
          // (il tutorial dei comandi appare dopo la raccolta).
          startIntroCinematic();
        };
        // C-02: probe WebXR — verifica onesta della disponibilità VR.
        mainMenu.onVrRequest = () => {
          audio.play({ name: 'ui_click', volume: 0.4 });
          void probeWebXr();
        };
        mainMenu.onOpenSettings = () => {
          audio.play({ name: 'ui_click', volume: 0.4 });
          settingsMenu.show(buildRuntimeSettings());
        };
        mainMenu.onOpenProgression = () => {
          audio.play({ name: 'ui_click', volume: 0.4 });
          progressionOverlay.show(buildProgressionOverlayData());
        };
      }

      // Richiedi il pointer lock su click
      const onCanvasClick = () => {
        unlockAudio();
        requestCanvasPointerLock();
      };
      canvas.addEventListener('click', onCanvasClick);
      detachCanvasClick = () => {
        canvas.removeEventListener('click', onCanvasClick);
      };

      state = 'running';
      onStatus?.('Pronto');

      // Il gioco parte in pausa con il menu principale visibile (G-09):
      // l'utente sceglie "INIZIA LA DISCESA" prima che il loop parta.
      mainMenu?.show({
        fragments: saveData?.payload.fragments ?? null,
        pyramidsUnlocked: saveData?.payload.pyramidsUnlocked ?? 1,
        bestiaryEntries: saveData?.payload.bestiaryEntries.length ?? 0,
      });
      localPause('menu');
    },

    start(): void {
      if (state !== 'running') return;
      lastTimeMs = 0;
      rafId = requestAnimationFrame(loop);
      log.info('Game loop avviato');
    },

    pause(reason: PauseReason = 'manual'): void {
      localPause(reason);
    },

    resume(reason: PauseReason = 'manual'): void {
      localResume(reason);
    },

    dispose(): void {
      if (state === 'disposed') return;
      cancelAnimationFrame(rafId);
      detachViewportListeners?.();
      detachViewportListeners = null;
      detachCanvasClick?.();
      detachCanvasClick = null;
      detachPointerLockListeners?.();
      detachPointerLockListeners = null;
      input.dispose();
      hud.dispose();
      cinematicOverlay?.dispose();
      settingsMenu.dispose();
      progressionOverlay.dispose();
      deathOverlay.dispose();
      mainMenu?.dispose();
      mainMenu = null;
      audio.dispose();
      renderer?.dispose();
      simulation.dispose();
      generationClient?.dispose();
      saveManager?.dispose();
      saveManager = null;
      saveData = null;
      guardianEntitySync?.dispose();
      guardianEntitySync = null;
      guardianRuntime?.dispose();
      guardianRuntime = null;
      enemyHurtboxes.clear();
      playerHitRegistry.clear();
      scarabState = null;
      mummyState = null;
      genericEnemyState = null;
      enemySpawnDirector = null;
      if (playerController && physicsWorld) {
        playerController.dispose(physicsWorld.raw);
      }
      physicsWorld?.dispose();
      pauseReasons.clear();
      pendingPointerLockRestore = false;
      state = 'disposed';
      log.info('GameApplication disposed');
    },
  };
}
