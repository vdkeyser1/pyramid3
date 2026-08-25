/**
 * ART-006 — Macchina a stati per trappole e meccanismo leva.
 *
 * Scopo: aggiornare ogni tick lo stato di ogni trappola, rilevare il contatto
 *   col giocatore, infliggere il danno corretto e animare i mesh tramite
 *   callback registrate dal renderer.
 * Ownership: gameplay. Consumato dal game loop principale.
 * Invarianti:
 *   - nessun Math.random(); nessun performance.now();
 *   - tutti i valori numerici provengono da TRAPS in balance.ts;
 *   - le callback di animazione (PressurePlateAnimator, PendulumAnimator,
 *     LeverAnimator) separano TrapSystem da Three.js: il gameplay non dipende
 *     dal renderer e i test possono girare in Node senza DOM;
 *   - TrapRuntimeState è un POJO serializzabile: può essere salvato e ripreso;
 *   - il danno accumulato in un tick viene restituito come somma intera di HP;
 *     il chiamante decide come applicarlo (con o senza invulnerabilità).
 * Failure mode: una trappola senza animator registrato si aggiorna ugualmente
 *   (lo stato avanza, il danno viene calcolato) — manca solo l'animazione visiva.
 */

import { TRAPS } from '@/content/balance.js';
import type { LeverRuntimeState, TrapRuntimeState } from '@/content/TrapDefinitions.js';
import type { FloorSceneLeverPassage, FloorSceneTrap } from '@/world/FloorSceneLayout.js';

// ---------------------------------------------------------------------------
// Tipi delle callback di animazione
// ---------------------------------------------------------------------------

/**
 * Anima le punte di una piastra a pressione.
 * spikesGroupY: lo scostamento verticale del gruppo delle punte rispetto
 *   all'origine della trappola. 0 = punte nascoste, spikeHeightM = estese.
 */
export type PressurePlateAnimator = (spikesGroupY: number) => void;

/**
 * Anima il perno di rotazione di un pendolo.
 * angleRad: angolo corrente del pivot attorno al proprio asse.
 *   Per corridoi sull'asse X il chiamante applica pivotGroup.rotation.z.
 *   Per corridoi sull'asse Z il chiamante applica pivotGroup.rotation.x.
 */
export type PendulumAnimator = (angleRad: number) => void;

/**
 * Anima la leva e il sigillo di pietra.
 * handleAngleRad: rotazione del manico attorno all'asse Z (0 = riposo, π/2 = tirata).
 * sealY: posizione Y del centro del sigillo (sealDropM/2 = chiuso, –sealDropM/2 = aperto).
 */
export type LeverAnimator = (handleAngleRad: number, sealY: number) => void;

// ---------------------------------------------------------------------------
// TrapSystem
// ---------------------------------------------------------------------------

export class TrapSystem {
  /** Stato di runtime di ogni trappola, indicizzato per trapId. */
  private readonly traps = new Map<string, TrapRuntimeState>();
  /** Stato di runtime della leva (al più una per piano). */
  private leverState: LeverRuntimeState | null = null;
  /** Posizione della leva in scena (serve per il test di prossimità). */
  private leverPassage: FloorSceneLeverPassage | null = null;

  /** Callback di animazione registrate dal renderer dopo la costruzione dei mesh. */
  private plateAnimators = new Map<string, PressurePlateAnimator>();
  private pendulumAnimators = new Map<string, PendulumAnimator>();
  private leverAnimator: LeverAnimator | null = null;

  /**
   * Tick globale dall'inizio del piano, incrementato a ogni chiamata a tick().
   * Usato per l'animazione sinusoidale del pendolo (oscillazione continua).
   */
  private elapsedTicks = 0;

  constructor(traps: readonly FloorSceneTrap[], leverPassage: FloorSceneLeverPassage | null) {
    for (const trap of traps) {
      this.traps.set(trap.trapId, {
        trapId: trap.trapId,
        kind: trap.kind,
        state: 'ARMED',
        timerTicks: 0,
        posX: trap.position.x,
        posZ: trap.position.z,
        corridorAxis: trap.corridorAxis ?? 'x',
        lastDamageElapsed: -9999,
      });
    }

    if (leverPassage) {
      this.leverPassage = leverPassage;
      this.leverState = {
        leverId: leverPassage.leverId,
        state: 'READY',
        timerTicks: 0,
        sealDropProgress: 0,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Registrazione degli animator (chiamata dal codice che crea la scena)
  // ---------------------------------------------------------------------------

  /**
   * Registra la callback di animazione per una piastra a pressione.
   * Chiamata tipicamente nell'onPressurePlateMeshReady di BuildDungeonLayoutOptions.
   */
  registerPressurePlateAnimator(trapId: string, fn: PressurePlateAnimator): void {
    this.plateAnimators.set(trapId, fn);
  }

  /**
   * Registra la callback di animazione per un pendolo a lama.
   * Chiamata tipicamente nell'onPendulumMeshReady di BuildDungeonLayoutOptions.
   */
  registerPendulumAnimator(trapId: string, fn: PendulumAnimator): void {
    this.pendulumAnimators.set(trapId, fn);
  }

  /**
   * Registra la callback di animazione per la leva + sigillo del piano.
   * Chiamata tipicamente nell'onLeverMeshReady di BuildDungeonLayoutOptions.
   */
  registerLeverAnimator(fn: LeverAnimator): void {
    this.leverAnimator = fn;
  }

  // ---------------------------------------------------------------------------
  // Aggiornamento per tick
  // ---------------------------------------------------------------------------

  /**
   * Avanza la simulazione di un tick (1/60 s).
   *
   * Ritorna il totale di HP da infliggere al giocatore in questo tick.
   * Chiamare questo metodo una volta per tick, anche se il giocatore è fermo:
   * i pendoli oscillano sempre, i cooldown scorrono sempre.
   *
   * @param playerX  Posizione X del giocatore (in metri, sistema di riferimento scena).
   * @param playerZ  Posizione Z del giocatore.
   */
  tick(playerX: number, playerZ: number): number {
    this.elapsedTicks++;
    let totalDamage = 0;

    for (const state of this.traps.values()) {
      if (state.kind === 'pressurePlate') {
        totalDamage += this.tickPressurePlate(state, playerX, playerZ);
      } else {
        // bladePendulum
        totalDamage += this.tickBladePendulum(state, playerX, playerZ);
      }
    }

    this.tickLever();
    return totalDamage;
  }

  /**
   * Tenta di attivare la leva se il giocatore è nel raggio di interazione.
   *
   * @returns true se la leva è stata attivata in questo frame, false altrimenti
   *   (leva assente, già tirata, o giocatore troppo lontano).
   */
  tryActivateLever(playerX: number, playerZ: number): boolean {
    if (!this.leverState || !this.leverPassage) return false;
    if (this.leverState.state !== 'READY') return false;

    const dx = playerX - this.leverPassage.leverPosition.x;
    const dz = playerZ - this.leverPassage.leverPosition.z;
    if (Math.sqrt(dx * dx + dz * dz) > TRAPS.lever.interactionRadiusM) return false;

    this.leverState.state = 'PULLING';
    this.leverState.timerTicks = TRAPS.lever.pullDurationTicks;
    return true;
  }

  /** Stato della leva — utile per l'UI (indicatore di interazione). */
  getLeverState(): 'READY' | 'PULLING' | 'PULLED' | null {
    return this.leverState?.state ?? null;
  }

  // ---------------------------------------------------------------------------
  // Logica interna — piastra a pressione
  // ---------------------------------------------------------------------------

  private tickPressurePlate(state: TrapRuntimeState, playerX: number, playerZ: number): number {
    const def = TRAPS.pressurePlate;
    let damage = 0;

    switch (state.state) {
      case 'ARMED': {
        const dx = playerX - state.posX;
        const dz = playerZ - state.posZ;
        if (Math.sqrt(dx * dx + dz * dz) < def.activationRadiusM) {
          // Il giocatore ha calpestato la piastra: infligge danno immediatamente
          // e avvia l'estensione delle punte.
          damage = def.damageHp;
          state.state = 'EXTEND';
          state.timerTicks = def.extendTicks;
        }
        break;
      }
      case 'EXTEND': {
        state.timerTicks--;
        if (state.timerTicks <= 0) {
          state.state = 'HOLD';
          state.timerTicks = def.holdTicks;
        }
        break;
      }
      case 'HOLD': {
        state.timerTicks--;
        if (state.timerTicks <= 0) {
          state.state = 'RETRACT';
          state.timerTicks = def.retractTicks;
        }
        break;
      }
      case 'RETRACT': {
        state.timerTicks--;
        if (state.timerTicks <= 0) {
          state.state = 'COOLDOWN';
          state.timerTicks = def.cooldownTicks;
        }
        break;
      }
      case 'COOLDOWN': {
        state.timerTicks--;
        if (state.timerTicks <= 0) {
          state.state = 'ARMED';
          state.timerTicks = 0;
        }
        break;
      }
    }

    this.animatePressurePlate(state);
    return damage;
  }

  private animatePressurePlate(state: TrapRuntimeState): void {
    const animator = this.plateAnimators.get(state.trapId);
    if (!animator) return;

    const def = TRAPS.pressurePlate;
    let spikesY: number;

    switch (state.state) {
      case 'ARMED':
      case 'COOLDOWN':
        spikesY = 0;
        break;
      case 'EXTEND': {
        // Interpolazione lineare: 0 → spikeHeightM durante extendTicks.
        const progress = 1 - state.timerTicks / def.extendTicks;
        spikesY = progress * def.spikeHeightM;
        break;
      }
      case 'HOLD':
        spikesY = def.spikeHeightM;
        break;
      case 'RETRACT': {
        // Interpolazione lineare: spikeHeightM → 0 durante retractTicks.
        const progress = 1 - state.timerTicks / def.retractTicks;
        spikesY = (1 - progress) * def.spikeHeightM;
        break;
      }
      default:
        spikesY = 0;
    }

    animator(spikesY);
  }

  // ---------------------------------------------------------------------------
  // Logica interna — pendolo a lama
  // ---------------------------------------------------------------------------

  private tickBladePendulum(state: TrapRuntimeState, playerX: number, playerZ: number): number {
    const def = TRAPS.bladePendulum;

    // Angolo corrente del pendolo: oscillazione sinusoidale continua.
    const halfSwingRad = (def.halfSwingDeg * Math.PI) / 180;
    const angle = halfSwingRad * Math.sin(
      (2 * Math.PI * this.elapsedTicks) / def.swingPeriodTicks,
    );

    // Anima il pivot.
    this.pendulumAnimators.get(state.trapId)?.(angle);

    // Posizione orizzontale della punta della lama in scena.
    // L'oscillazione è perpendicolare all'asse del corridoio:
    //   corridoio lungo X → lama si sposta su Z (rotation.z del pivot)
    //   corridoio lungo Z → lama si sposta su X (rotation.x del pivot)
    const bladeOffset = def.armLengthM * Math.sin(angle);
    const bladeX = state.corridorAxis === 'z' ? state.posX + bladeOffset : state.posX;
    const bladeZ = state.corridorAxis === 'x' ? state.posZ + bladeOffset : state.posZ;

    const dx = playerX - bladeX;
    const dz = playerZ - bladeZ;
    const distToBlade = Math.sqrt(dx * dx + dz * dz);

    if (distToBlade < def.hitRadiusM) {
      // Cooldown: la lama non colpisce ogni tick, solo una volta per
      // semioscillazione. hitCooldownTicks ≈ metà del periodo.
      const ticksSinceLastHit = this.elapsedTicks - state.lastDamageElapsed;
      if (ticksSinceLastHit >= def.hitCooldownTicks) {
        state.lastDamageElapsed = this.elapsedTicks;
        return def.damageHp;
      }
    }

    return 0;
  }

  // ---------------------------------------------------------------------------
  // Logica interna — meccanismo leva
  // ---------------------------------------------------------------------------

  private tickLever(): void {
    if (!this.leverState) return;
    const lever = this.leverState;
    const def = TRAPS.lever;

    switch (lever.state) {
      case 'READY':
        // In attesa: l'animazione mostra la leva a riposo (handleAngle = –0,35 rad).
        this.leverAnimator?.(-0.35, def.sealDropM / 2);
        break;

      case 'PULLING': {
        // Il giocatore sta tirando: il manico ruota verso π/2.
        lever.timerTicks--;
        const pullProgress = 1 - lever.timerTicks / def.pullDurationTicks;
        // Interpolazione: –0,35 → π/2 durante pullDurationTicks.
        const handleAngle = -0.35 + pullProgress * (Math.PI / 2 + 0.35);
        // Il sigillo rimane fermo finché la leva non è tirata del tutto.
        this.leverAnimator?.(handleAngle, def.sealDropM / 2);

        if (lever.timerTicks <= 0) {
          // Leva completamente tirata: inizia la discesa del sigillo.
          lever.state = 'PULLED';
          lever.timerTicks = def.sealDropTicks;
          lever.sealDropProgress = 0;
        }
        break;
      }

      case 'PULLED': {
        if (lever.timerTicks > 0) {
          // Fase di discesa del sigillo.
          lever.timerTicks--;
          lever.sealDropProgress = 1 - lever.timerTicks / def.sealDropTicks;
        }
        // sealY: da sealDropM/2 (chiuso) a –sealDropM/2 (aperto).
        // Formula: sealY = (sealDropM/2) * (1 – 2 * progress)
        const sealY = (def.sealDropM / 2) * (1 - 2 * lever.sealDropProgress);
        this.leverAnimator?.(Math.PI / 2, sealY);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Accesso allo stato (per salvataggio / debug)
  // ---------------------------------------------------------------------------

  /** Snapshot POJO di tutti gli stati di runtime — serializzabile. */
  getSnapshot(): {
    traps: TrapRuntimeState[];
    lever: LeverRuntimeState | null;
    elapsedTicks: number;
  } {
    return {
      traps: [...this.traps.values()],
      lever: this.leverState ? { ...this.leverState } : null,
      elapsedTicks: this.elapsedTicks,
    };
  }
}
