/**
 * Scopo: first-person character controller basato su Rapier KinematicCharacterController.
 * Ownership: il sistema Player possiede l'istanza.
 *
 * Il controller gestisce:
 *   - movimento WASD con accelerazione/decelerazione a terra e in aria
 *   - sprint (shift)
 *   - crouch (ctrl) — riduce l'altezza della capsula
 *   - salto (space) con coyote time
 *   - gravità applicata manualmente (il character controller è kinematic)
 *   - snap-to-ground e autostep per scale/piccoli ostacoli
 *
 * Invarianti:
 *   - input buffer: gli input vengono bufferizzati per INPUT_BUFFER_TICKS
 *     tick e consumati al prossimo tick valido (es. salto dopo essere atterrati)
 *   - coyote time: dopo aver lasciato una superficie walkable, il salto è
 *     ancora possibile per COYOTE_TICKS tick
 *   - il movimento orizzontale viene calcolato come accelerazione verso
 *     la velocità desiderata, non come set diretto di velocità
 */

import RAPIER from '@dimforge/rapier3d-compat';
import {
  PLAYER,
  TICK_HZ,
} from '@/content/balance.js';
import { INTERACTION_GROUPS } from '@/physics/CollisionLayers.js';
import { createLogger, type Logger } from '@/core/Logger.js';

// ── Tipi ─────────────────────────────────────────────────────────────────────

export interface PlayerInput {
  /** Direzione di movimento sul piano XZ (normalizzata). */
  readonly moveX: number;
  readonly moveZ: number;
  /** Input saltare (premuto questo frame). */
  readonly jump: boolean;
  /** Input sprint (tenuto premuto). */
  readonly sprint: boolean;
  /** Input crouch (toggle o hold). */
  readonly crouch: boolean;
  /** Rotazione Yaw della camera (radianti). */
  readonly yaw: number;
  /** Rotazione Pitch della camera (radianti). */
  readonly pitch: number;
}

export interface PlayerState {
  /** Posizione del player nel mondo (centro capsula). */
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  /** Velocità corrente (per debugging/UI). */
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number };
  /** true se il player è a contatto col terreno. */
  readonly grounded: boolean;
  /** true se il player sta sprintando. */
  readonly sprinting: boolean;
  /** true se il player è accovacciato. */
  readonly crouching: boolean;
  /** Altezza corrente della capsula (varia con crouch). */
  readonly currentHeight: number;
  /** Yaw corrente (radianti). */
  readonly yaw: number;
  /** Pitch corrente (radianti). */
  readonly pitch: number;
}

/** Input vuoto predefinito. */
export const EMPTY_INPUT: PlayerInput = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  sprint: false,
  crouch: false,
  yaw: 0,
  pitch: 0,
};

// ── Costanti interne ─────────────────────────────────────────────────────────

/** Offset per il character controller (piccolo gap per stabilità numerica). */
const CONTROLLER_OFFSET = 0.01;
/** Velocità verticale massima di caduta (terminal velocity). */
const MAX_FALL_SPEED = -30.0;
/** Forza del salto (velocità verticale iniziale in m/s). */
const JUMP_VELOCITY = 5.0;
/** Soglia sotto la quale la velocità orizzontale viene azzerata. */
const STOP_THRESHOLD = 0.1;
/** Altezza della capsula quando crouched. */
const CROUCH_HEIGHT = 1.0;
/** Velocità di transizione crouch (m/s verso l'altezza target). */
const CROUCH_TRANSITION_SPEED = 0.15;
/** Distanza snap-to-ground (rileva il terreno sotto i piedi). */
const SNAP_TO_GROUND_DISTANCE = 0.3;
/** Dimensione minima per autostep. */
const AUTOSTEP_MIN_WIDTH = 0.1;
/** G-18 V4: raggio entro cui il doorway snap assist attira verso la porta. */
const DOORWAY_ASSIST_RADIUS = 1.6;
/** G-18 V4: intensità massima della deviazione verso il centro della porta. */
const DOORWAY_ASSIST_STRENGTH = 0.28;

/**
 * G-18 V4: doorway snap assist (pura) — devia la direzione di movimento verso
 * il centro della porta più vicina quando il player è entro il raggio e punta
 * verso l'apertura. Ritorna la direzione corretta (normalizzata, invariata se
 * nessuna porta è abbastanza vicina/allineata).
 */
export function applyDoorwaySnapAssist(
  moveDir: { readonly x: number; readonly z: number },
  playerX: number,
  playerZ: number,
  doorways: readonly { readonly x: number; readonly z: number }[],
): { readonly x: number; readonly z: number } {
  if (doorways.length === 0 || (moveDir.x === 0 && moveDir.z === 0)) {
    return { x: moveDir.x, z: moveDir.z };
  }

  let nearestAssist = 0;
  let assistX = 0;
  let assistZ = 0;
  for (const doorway of doorways) {
    const dx = doorway.x - playerX;
    const dz = doorway.z - playerZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > DOORWAY_ASSIST_RADIUS) continue;
    // Allineamento col movimento: quanto il player sta puntando alla porta
    const toDoorX = dx / dist;
    const toDoorZ = dz / dist;
    const dot = moveDir.x * toDoorX + moveDir.z * toDoorZ;
    if (dot <= 0.15) continue;
    const proximity = 1 - dist / DOORWAY_ASSIST_RADIUS; // 0..1 vicino
    const strength = proximity * dot * DOORWAY_ASSIST_STRENGTH;
    if (strength > nearestAssist) {
      nearestAssist = strength;
      assistX = toDoorX;
      assistZ = toDoorZ;
    }
  }

  if (nearestAssist <= 0) {
    return { x: moveDir.x, z: moveDir.z };
  }

  const blend = 1 - nearestAssist; // più vicino ⇒ meno blend
  let outX = moveDir.x * blend + assistX * nearestAssist;
  let outZ = moveDir.z * blend + assistZ * nearestAssist;
  const norm = Math.sqrt(outX * outX + outZ * outZ);
  if (norm > 0) {
    outX /= norm;
    outZ /= norm;
  }
  return { x: outX, z: outZ };
}

// ── PlayerCharacterController ─────────────────────────────────────────────────

export class PlayerCharacterController {
  private readonly log: Logger;

  // Componenti Rapier
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;

  // Stato movimento
  private velocityY = 0;
  private currentHorizontalSpeed = 0;
  private grounded = false;
  private sprinting = false;
  private crouching = false;
  private currentHeight: number;

  // Timer in tick
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

  // Input bufferizzato
  private bufferedJump = false;

  // Camera
  private yaw = 0;
  private pitch = 0;

  // Parametri di bilanciamento (readonly reference)
  private readonly walkSpeed: number;
  private readonly sprintSpeed: number;
  private readonly capsuleRadius: number;
  /** GAME-ART: moltiplicatore velocità da sinergie (1 = default). */
  private speedMultiplier = 1;

  // G-18 V4: doorway snap assist — centri delle aperture del piano corrente.
  private doorways: readonly { readonly x: number; readonly z: number }[] = [];

  constructor(
    world: RAPIER.World,
    startX: number,
    startY: number,
    startZ: number,
    startYaw = 0,
    startPitch = 0,
  ) {
    this.log = createLogger('PlayerController');
    this.walkSpeed = PLAYER.walkSpeedMps;
    this.sprintSpeed = PLAYER.sprintSpeedMps;
    this.capsuleRadius = PLAYER.capsuleRadiusM;
    this.currentHeight = PLAYER.capsuleHeightM;
    this.yaw = startYaw;
    this.pitch = startPitch;

    // ── Corpo cinematico ──────────────────────────────────────────────
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(startX, startY, startZ);
    this.body = world.createRigidBody(bodyDesc);

    // ── Collider capsula ──────────────────────────────────────────────
    const halfHeight = (this.currentHeight - 2 * this.capsuleRadius) / 2;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, this.capsuleRadius)
      .setCollisionGroups(INTERACTION_GROUPS.PLAYER)
      .setActiveCollisionTypes(
        RAPIER.ActiveCollisionTypes.DEFAULT |
        RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED,
      )
      .setFriction(0.0)
      .setRestitution(0.0);
    this.collider = world.createCollider(colliderDesc, this.body);

    // ── Character controller ─────────────────────────────────────────
    this.controller = world.createCharacterController(CONTROLLER_OFFSET);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(70); // ~70 kg
    this.controller.setMaxSlopeClimbAngle((PLAYER.maxSlopeDeg * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle(
      ((PLAYER.maxSlopeDeg + 5) * Math.PI) / 180,
    );
    this.controller.enableAutostep(
      PLAYER.maxStepM,
      AUTOSTEP_MIN_WIDTH,
      false, // non step su corpi dinamici
    );
    this.controller.enableSnapToGround(SNAP_TO_GROUND_DISTANCE);
    this.controller.setSlideEnabled(true);

    this.log.info('PlayerCharacterController creato', {
      position: { x: startX, y: startY, z: startZ },
      height: this.currentHeight,
      radius: this.capsuleRadius,
    });
  }

  // ── API pubblica ──────────────────────────────────────────────────────────

  /**
   * G-10: teletrasporto alla entry del nuovo piano (discesa). Resetta la
   * velocità verticale e l'ancora di atterraggio.
   */
  teleport(x: number, y: number, z: number): void {
    this.body.setTranslation({ x, y, z }, true);
    this.velocityY = 0;
    this.grounded = false;
    this.log.info('Player teletrasportato', { x, y, z });
  }

  /** Restituisce lo stato corrente del player (per rendering/UI). */
  getState(): PlayerState {
    const pos = this.body.translation();
    const vel = this.body.linvel();
    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      velocity: { x: vel.x, y: vel.y, z: vel.z },
      grounded: this.grounded,
      sprinting: this.sprinting,
      crouching: this.crouching,
      currentHeight: this.currentHeight,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  /** Restituisce il collider del player (per query/raycast esclusione). */
  getCollider(): RAPIER.Collider {
    return this.collider;
  }

  /** Restituisce il corpo rigido del player. */
  getBody(): RAPIER.RigidBody {
    return this.body;
  }

  /** Restituisce true se il player è a terra. */
  isGrounded(): boolean {
    return this.grounded;
  }

  /**
   * G-18 V4: doorway snap assist — imposta i centri delle aperture del piano.
   * Quando il player è vicino a una porta e si muove verso di essa, il
   * movimento viene deviato dolcemente verso il centro per evitare di
   * incastrarsi sugli spigoli degli stipiti.
   */
  setDoorways(doorways: readonly { readonly x: number; readonly z: number }[]): void {
    this.doorways = doorways;
  }

  /** Applica moltiplicatore velocità (sinergie / maledizioni). Clamp 0.25..2. */
  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.25, Math.min(2, multiplier));
  }

  /** Applica input e avanza il controller di un tick (60 Hz). */
  update(input: PlayerInput, _tick: number, _deltaMs: number): void {
    // Aggiorna orientamento camera
    this.yaw = input.yaw;
    this.pitch = input.pitch;

    // Bufferizza il salto
    if (input.jump) {
      this.bufferedJump = true;
      this.jumpBufferTimer = PLAYER.inputBufferTicks;
    }

    // Determina stato crouch/sprint
    this.sprinting = input.sprint && !input.crouch;
    this.crouching = input.crouch;

    // Target speed
    const hasInput = Math.abs(input.moveX) > 0.01 || Math.abs(input.moveZ) > 0.01;
    let targetSpeed: number;
    if (this.crouching) {
      targetSpeed = PLAYER.crouchSpeedMps;
    } else if (this.sprinting) {
      targetSpeed = this.sprintSpeed;
    } else {
      targetSpeed = this.walkSpeed;
    }
    targetSpeed *= this.speedMultiplier;

    // Accelerazione / decelerazione
    const accel = this.grounded
      ? (hasInput ? PLAYER.groundAccelerationMps2 : PLAYER.groundDecelerationMps2)
      : PLAYER.airAccelerationMps2;

    const dt = 1.0 / TICK_HZ;

    if (hasInput) {
      this.currentHorizontalSpeed = Math.min(
        this.currentHorizontalSpeed + accel * dt,
        targetSpeed,
      );
    } else {
      this.currentHorizontalSpeed = Math.max(
        this.currentHorizontalSpeed - accel * dt,
        0,
      );
    }

    // Soglia di stop
    if (this.currentHorizontalSpeed < STOP_THRESHOLD) {
      this.currentHorizontalSpeed = 0;
    }

    // ── Direzione di movimento (mutabile: il snap assist la devia) ──
    const computedDir = this.computeMoveDirection(input.moveX, input.moveZ);
    const moveDir = { x: computedDir.x, z: computedDir.z };

    // ── G-18 V4: doorway snap assist ────────────────────────────────
    // Quando il player è entro DOORWAY_ASSIST_RADIUS da una porta e il suo
    // movimento punta verso l'apertura (dot > 0), devia dolcemente verso il
    // centro: la capsula non si incastra più sugli spigoli degli stipiti.
    if (this.doorways.length > 0) {
      const pos = this.body.translation();
      const assisted = applyDoorwaySnapAssist(moveDir, pos.x, pos.z, this.doorways);
      moveDir.x = assisted.x;
      moveDir.z = assisted.z;
    }

    // ── Velocità verticale ──────────────────────────────────────────
    // Coyote time
    if (this.grounded) {
      this.coyoteTimer = PLAYER.coyoteTicks;
      this.velocityY = Math.max(this.velocityY, 0); // ferma la caduta
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - 1);
    }

    // Jump buffer
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer--;
    } else {
      this.bufferedJump = false;
    }

    // Salto
    if (this.bufferedJump && this.coyoteTimer > 0) {
      this.velocityY = JUMP_VELOCITY;
      this.bufferedJump = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // Gravità
    if (!this.grounded) {
      this.velocityY += -9.81 * dt;
      this.velocityY = Math.max(this.velocityY, MAX_FALL_SPEED);
    }

    // ── Desired translation ─────────────────────────────────────────
    const horizontalSpeed = this.currentHorizontalSpeed;
    const desiredX = moveDir.x * horizontalSpeed * dt;
    const desiredZ = moveDir.z * horizontalSpeed * dt;
    const desiredY = this.velocityY * dt;

    const desiredTranslation = new RAPIER.Vector3(desiredX, desiredY, desiredZ);

    // ── Character controller movement ───────────────────────────────
    this.controller.computeColliderMovement(
      this.collider,
      desiredTranslation,
    );

    const corrected = this.controller.computedMovement();

    // Applica il movimento corretto al corpo cinematico
    const currentPos = this.body.translation();
    const nextPos = new RAPIER.Vector3(
      currentPos.x + corrected.x,
      currentPos.y + corrected.y,
      currentPos.z + corrected.z,
    );
    this.body.setNextKinematicTranslation(nextPos);

    // Aggiorna stato grounded
    this.grounded = this.controller.computedGrounded();

    // Se il movimento verticale è stato bloccato (es. atterrato), azzera velocityY
    if (this.grounded && this.velocityY < 0) {
      this.velocityY = 0;
    }

    // ── Crouch: transizione altezza capsula ────────────────────────
    const targetHeight = this.crouching ? CROUCH_HEIGHT : PLAYER.capsuleHeightM;
    if (Math.abs(this.currentHeight - targetHeight) > 0.001) {
      const delta = targetHeight - this.currentHeight;
      const step = Math.sign(delta) * Math.min(Math.abs(delta), CROUCH_TRANSITION_SPEED);
      const newHeight = this.currentHeight + step;
      this.setCapsuleHeight(newHeight);
    }
  }

  /** Rilascia le risorse Rapier. */
  dispose(world: RAPIER.World): void {
    world.removeCharacterController(this.controller);
    world.removeCollider(this.collider, false);
    world.removeRigidBody(this.body);
    this.controller.free();
    this.log.info('PlayerCharacterController disposed');
  }

  // ── Metodi privati ────────────────────────────────────────────────────────

  /**
   * Calcola la direzione di movimento sul piano XZ a partire da input
   * e orientamento camera (yaw).
   */
  private computeMoveDirection(
    inputX: number,
    inputZ: number,
  ): { readonly x: number; readonly z: number } {
    if (inputX === 0 && inputZ === 0) {
      return { x: 0, z: 0 };
    }

    // Normalizza l'input
    const len = Math.sqrt(inputX * inputX + inputZ * inputZ);
    const nx = inputX / len;
    const nz = inputZ / len;

    // Ruota in base allo yaw
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    return {
      x: nx * cosY - nz * sinY,
      z: -nx * sinY - nz * cosY,
    };
  }

  /**
   * Aggiorna l'altezza della capsula (usato per crouch).
   * Ricrea il collider perché Rapier non supporta il ridimensionamento
   * runtime diretto di una capsula.
   */
  private setCapsuleHeight(height: number): void {
    const clampedHeight = Math.max(CROUCH_HEIGHT, Math.min(height, PLAYER.capsuleHeightM));
    this.currentHeight = clampedHeight;

    const halfHeight = (clampedHeight - 2 * this.capsuleRadius) / 2;
    if (halfHeight <= 0) return;

    this.collider.setHalfHeight(halfHeight);
  }
}
