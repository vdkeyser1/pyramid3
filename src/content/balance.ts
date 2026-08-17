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
  walkSpeedMps: 3.4,
  sprintSpeedMps: 5.2,
  crouchSpeedMps: 1.8,
  groundAccelerationMps2: 22,
  groundDecelerationMps2: 26,
  airAccelerationMps2: 4,
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
} as const;

export const WEAPONS = {
  fists:   { damageHp: 3,  intervalTicks: secondsToTicks(0.65), reachM: 1.1, durability: Number.POSITIVE_INFINITY },
  khopesh: { damageHp: 18, intervalTicks: secondsToTicks(0.78), reachM: 1.7, durability: 120 },
  staff:   { damageHp: 11, intervalTicks: secondsToTicks(0.55), reachM: 2.2, durability: 180 },
  shovel:  { damageHp: 7,  intervalTicks: secondsToTicks(1.0),  reachM: 1.5, durability: 30 }, // in scavi
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
