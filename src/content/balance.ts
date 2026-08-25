/**
 * Scopo: unico punto di verità per i valori numerici di gameplay.
 * Ownership: contenuto immutabile. La simulazione legge, non scrive mai.
 * Invarianti:
 *   - nessun valore magico di gameplay deve esistere fuori da questo file;
 *   - tutte le durate di simulazione sono in TICK interi (60 Hz);
 *   - i nomi portano l'unità di misura.
 * Failure mode: un valore fuori range viene rifiutato da verify-content.mjs a
 *   build time, prima che raggiunga il runtime.
 */

export const TICK_HZ = 60 as const;
export const secondsToTicks = (seconds: number): number => Math.round(seconds * TICK_HZ);

export const PLAYER = {
  walkSpeedMps: 4.5,
  sprintSpeedMps: 7.0,
  crouchSpeedMps: 2.0,
  groundAccelerationMps2: 40,
  groundDecelerationMps2: 50,
  airAccelerationMps2: 5,
  capsuleHeightM: 1.75,
  capsuleRadiusM: 0.32,
  maxStepM: 0.3,
  maxSlopeDeg: 45,
  dodgeDistanceM: 2.4,
  dodgeDurationTicks: secondsToTicks(0.34),
  dodgeInvulnerabilityTicks: 0, // 0.12 s solo con il nodo meta "Passo di Bastet"
  coyoteTicks: secondsToTicks(0.12),
  inputBufferTicks: secondsToTicks(0.13),
  baseHealthHp: 100,
  fovMinDeg: 75,
  fovMaxDeg: 105,
  headBobAmplitudeM: 0.02,
  landingDipM: 0.05,
  landingDipDurationTicks: secondsToTicks(0.1),
  maxCameraAssistRotationDegPerS: 0,
} as const;

export const NOISE_MULTIPLIER = {
  crouch: 0.2,
  walk: 1.0,
  sprint: 2.8,
  dodge: 2.2,
  lightAttack: 1.5,
  heavyAttack: 3.0,
  dig: 5.0,
  kaEcho: 4.0,
} as const;

export const TORCH = {
  initialFuelSeconds: 180,
  /** Consumo relativo allo stato ALTA. */
  drainRatioByState: { OFF: 0, LOW: 0.4, HIGH: 1.0, PLACED: 1.0 } as const,
  waveDurationTicks: secondsToTicks(0.8),
  waveCooldownTicks: secondsToTicks(2.0),
  brazierIgnitionCostSeconds: 12,
  brazierRefillCapSeconds: 60,
  brazierDarknessDebtRelief: 8,
  kaEchoCostSeconds: 3,
  kaEchoCooldownTicks: secondsToTicks(12),
  kaEchoDurationTicks: secondsToTicks(1.5),
} as const;

export const COMBAT = {
  armorCap: 0.75,
  minimumDamageHp: 1,
  maxHeavyHitStunPerSecond: 1 / 1.2,
  minHeavyAnticipationTicks: secondsToTicks(0.55),
  hitStopHeavyMs: 70,
  hitStopLightMs: 45,
  newRoomGraceTicks: secondsToTicks(2.0),
  /** §9.2: due attacchi pesanti da nemici diversi non possono sovrapporsi entro 0,4 s */
  heavyOverlapGuardTicks: secondsToTicks(0.4),
  /** §9.4: durabilità ×2 contro nemici corazzati, ×0.5 contro molli */
  durabilityMultiplierArmored: 2,
  durabilityMultiplierSoft: 0.5,
  /** §9.4: al 20% durabilità avviso visivo/sonoro */
  durabilityWarningThreshold: 0.2,
  /** G-06: cooldown del quick-switch tra slot arma PRIMARY/SECONDARY. */
  weaponSwapCooldownTicks: secondsToTicks(0.35),
} as const;

/**
 * ART-005: geometria della scala di discesa fra i piani.
 *
 * Sta qui e non nel renderer perché sono valori di gameplay: l'alzata
 * determina se i gradini sono risalibili, e la corsa totale determina dove
 * scatta il cambio piano. Il rendering e la simulazione devono leggerli
 * dalla stessa fonte, altrimenti il trigger finisce a mezz'aria.
 */
export const STAIRCASE = {
  stepCount: 12,
  /** Alzata: deve restare sotto PLAYER.maxStepM o la scala non si risale. */
  stepRiseM: 0.24,
  stepRunM: 0.46,
  widthM: 2.6,
  stepThicknessM: 0.22,
  /** Lunghezza del pianerottolo in fondo. */
  landingDepthM: 2.0,
  /** Raggio entro cui il pianerottolo attiva il cambio piano. */
  triggerRadiusM: 1.8,
} as const;

export const WEAPONS = {
  fists:   { damageHp: 3,  intervalTicks: secondsToTicks(0.65), reachM: 1.1, durability: Number.POSITIVE_INFINITY },
  khopesh: { damageHp: 18, intervalTicks: secondsToTicks(0.78), reachM: 1.7, durability: 120 },
  staff:   { damageHp: 11, intervalTicks: secondsToTicks(0.55), reachM: 2.2, durability: 180 },
  shovel:  { damageHp: 7,  intervalTicks: secondsToTicks(1.0),  reachM: 1.5, durability: 3  }, // in scavi
} as const;

export const DIGGING = {
  totalDurationTicks: secondsToTicks(8),
  segments: 4,
  fragmentRewardAmount: 12,
  soundingDurationTicks: secondsToTicks(0.6),
  soundingNearRadiusM: 1.5,
  soundingMidRadiusM: 6.0,
  passiveHintAfterTicks: secondsToTicks(60),
  maxSoundingsForCertainty: 3,
  soundingNoiseIntensity: 2.0,
} as const;

export const DIRECTOR = {
  minSpawnDistanceM: 4,
  retryGraceTicks: secondsToTicks(90),
  retryGraceBudgetFactor: 0.75,
  lowFuelAmbushThresholdSeconds: 15,
  maxUntelegraphedEncountersPerRooms: { encounters: 1, rooms: 3 },
  /** Fasce di potere: nodi meta acquistati -> moltiplicatore aggiuntivo del budget. */
  powerBands: [
    { maxNodes: 2, extraBudgetFactor: 0.0 },
    { maxNodes: 5, extraBudgetFactor: 0.15 },
    { maxNodes: 8, extraBudgetFactor: 0.3 },
    { maxNodes: Number.POSITIVE_INFINITY, extraBudgetFactor: 0.45 },
  ],
} as const;

export const FLOOR_CONSTRAINTS = {
  mapToTreasureMinGraphDistance: 2,
  mapToTreasureMaxGraphDistance: 6,
  tutorialMapToTreasureMinGraphDistance: 1,
  minLoopEveryNodes: 9,
  maxPrimaryChoicesPerJunctionTutorial: 3,
  braidingRatio: 0.25,
  corridorBias: 0.6,
  sarcophagiPerRoom: { mean: 1.8, tolerance: 0.4 },
} as const;

export const DARKNESS = {
  thresholds: { calm: 25, whispers: 50, patrols: 75, witness: 100 },
  sanctuaryRecoveryPerSecond: 4,
} as const;

/**
 * ART-006: trappole procedurali e meccanismo leva+sigillo.
 *
 * I danni sono calibrati su PLAYER.baseHealthHp = 100.
 * - Piastra: 15 HP — evitabile se il giocatore è attento (vede la lastra).
 * - Pendolo: 22 HP — meno evitabile perché occupa l'intero corridoio.
 * - Un'unica attivazione di piastra non è letale; due di fila in cooldown
 *   corto sì — la pressione su torch gestione non è casuale.
 *
 * I timer di estensione (0,15 s) e ritrazione (0,40 s) danno tempo di
 * reagire senza rendere la trappola banale. Il cooldown (4,0 s) impedisce
 * lo spam ma lascia la stanza sempre pericolosa al secondo passaggio.
 */
export const TRAPS = {
  pressurePlate: {
    damageHp: 15,
    /** Raggio di attivazione dal centro della piastra. */
    activationRadiusM: 0.55,
    /** Altezza delle punte sopra il pavimento quando estese. */
    spikeHeightM: 0.58,
    /** Durata della fase di estensione (punte in salita). */
    extendTicks: secondsToTicks(0.15),
    /** Durata della fase di mantenimento (punte ferme e danno attivo). */
    holdTicks: secondsToTicks(1.2),
    /** Durata della fase di rientro. */
    retractTicks: secondsToTicks(0.40),
    /** Cooldown prima che la trappola si riarmi. */
    cooldownTicks: secondsToTicks(4.0),
  },
  bladePendulum: {
    damageHp: 22,
    /** Semiescursione del pendolo in gradi. */
    halfSwingDeg: 75,
    /** Durata di un'oscillazione completa (andata e ritorno). */
    swingPeriodTicks: secondsToTicks(2.6),
    /** Larghezza della lama — dimensiona il mesh. */
    bladeWidthM: 1.5,
    /** Quota del perno di rotazione (asse di montaggio). */
    mountHeightM: 3.0,
    /** Lunghezza del braccio dal perno alla lama. */
    armLengthM: 1.8,
    /** Raggio di colpo dalla punta della lama. */
    hitRadiusM: 0.6,
    /**
     * Cooldown minimo fra due colpi dello stesso pendolo, in tick.
     * Impedisce che la lama infligga danno ogni tick nel punto di passaggio.
     * Calcolato come metà periodo: la lama passa al centro una volta per
     * semioscillazione.
     */
    hitCooldownTicks: secondsToTicks(1.3),
    /**
     * Soglia di lunghezza corridoio per piazzare un pendolo.
     * Deve allinearsi con PENDULUM_MIN_CORRIDOR_M in FloorSceneLayout.ts.
     */
    minCorridorLengthM: 8.0,
  },
  lever: {
    /** Raggio entro cui il giocatore può interagire con la leva. */
    interactionRadiusM: 1.4,
    /** Durata dell'animazione di tiro della leva. */
    pullDurationTicks: secondsToTicks(0.9),
    /**
     * Distanza di discesa del sigillo di pietra.
     * Deve superare WALL_HEIGHT_M (4,5 m) nel renderer perché il sigillo
     * deve scomparire completamente sotto il pavimento.
     */
    sealDropM: 2.8,
    /** Durata dell'animazione di discesa del sigillo dopo il tiro. */
    sealDropTicks: secondsToTicks(2.0),
    /**
     * Piano minimo in cui compare il meccanismo leva.
     * I piani 1-2 sono di tutorial: nessuna leva.
     */
    minFloorIndex: 3,
  },
} as const;
