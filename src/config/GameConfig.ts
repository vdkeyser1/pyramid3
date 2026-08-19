/**
 * Scopo: singolo punto di verità per la configurazione di gioco.
 * Ownership: immutabile dopo il bootstrap. La simulazione legge, non scrive.
 *
 * Fonti: config.json (build-time), URL params, localStorage (runtime),
 *        rilevamento automatico (render backend, performance tier).
 */

import { z } from 'zod/v4';

export const RenderBackend = {
  WebGPU: 'webgpu',
  WebGL2: 'webgl2',
} as const;
export type RenderBackend = (typeof RenderBackend)[keyof typeof RenderBackend];

export const QualityTier = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;
export type QualityTier = (typeof QualityTier)[keyof typeof QualityTier];

export const GameConfigSchema = z.object({
  render: z.object({
    backend: z.enum(['webgpu', 'webgl2']).default('webgpu'),
    qualityTier: z.enum(['low', 'medium', 'high']).default('medium'),
    fov: z.number().min(75).max(105).default(90),
    resolutionScale: z.number().min(0.5).max(2.0).default(1.0),
    vsync: z.boolean().default(true),
  }),
  audio: z.object({
    masterVolume: z.number().min(0).max(1).default(0.8),
    sfxVolume: z.number().min(0).max(1).default(1.0),
    musicVolume: z.number().min(0).max(1).default(0.6),
    hrtf: z.boolean().default(true),
  }),
  accessibility: z.object({
    assistedLight: z.boolean().default(false),
    amplifiedTelegraphs: z.boolean().default(false),
    highContrast: z.boolean().default(false),
    colorBlindMode: z.enum(['none', 'protanopia', 'deuteranopia', 'tritanopia']).default('none'),
    subtitleNames: z.boolean().default(true),
    subtitleDirections: z.boolean().default(true),
    soundIndicator: z.boolean().default(false),
    textScale: z.number().min(1.0).max(1.6).default(1.0),
    sprintToggle: z.boolean().default(false),
    reduceCameraShake: z.boolean().default(false),
    reduceParticleEffects: z.boolean().default(false),
    staticCrosshair: z.boolean().default(false),
    reduceTorchFlicker: z.boolean().default(false),
    disableMotionBlur: z.boolean().default(false),
    showDarknessBar: z.boolean().default(false),
  }),
  controls: z.object({
    mouseSensitivity: z.number().min(0.1).max(5.0).default(1.2),
    mouseSmoothing: z.number().min(0.0).max(0.95).default(0.10),
    invertY: z.boolean().default(false),
    controllerDeadzone: z.number().min(0.01).max(0.5).default(0.15),
  }),
  debug: z.object({
    showOverlay: z.boolean().default(false),
    logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).default('INFO'),
    fixedSeed: z.number().nullable().default(null),
  }),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

export const DEFAULT_CONFIG: GameConfig = GameConfigSchema.parse({
  render: {},
  audio: {},
  accessibility: {},
  controls: {},
  debug: {},
});
