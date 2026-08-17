/**
 * Scopo: tradurre effetti di gameplay locali in DomainEvent consumabili da HUD,
 * audio, persistenza e replay.
 * Ownership: GameApplication usa questo bridge per i sistemi ancora orchestrati
 * manualmente fuori dallo scheduler ECS.
 * Invarianti:
 *   - nessun side-effect UI/audio diretto;
 *   - ogni effetto viene convertito in eventi serializzabili;
 *   - la posizione resta opzionale per consentire sorgenti astratte.
 * Failure mode: eventi incompleti vengono semplicemente omessi; nessuna
 * eccezione per dati parziali.
 */

import type { DigEvent } from '@/gameplay/digging/DiggingSystem.js';
import type { BrazierEffect } from '@/gameplay/torch/BrazierSystem.js';
import type { TorchStepResult, TorchRuntime } from '@/gameplay/torch/TorchSystem.js';
import type { DomainEventQueue } from '@/simulation/DomainEventQueue.js';

export interface GameplayEventPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function emitPositioned(
  queue: DomainEventQueue,
  kind:
    | 'TORCH_STATE_CHANGED'
    | 'TORCH_FUEL_LOW'
    | 'TORCH_FUEL_EMPTY'
    | 'NOISE_PULSE'
    | 'LIGHT_PULSE'
    | 'KA_ECHO_PULSE'
    | 'DIG_PROGRESS'
    | 'DIG_COMPLETE'
    | 'TREASURE_FOUND'
    | 'BRAZIER_LIT'
    | 'MAP_REVEAL'
    | 'DARKNESS_RELIEF',
  position: GameplayEventPosition | undefined,
  data: Record<string, unknown>,
): void {
  queue.emit(position ? { kind, position, data } : { kind, data });
}

function torchStatePayload(previous: TorchRuntime, next: TorchRuntime): Record<string, unknown> {
  return {
    previousState: previous.state,
    nextState: next.state,
    fuelSeconds: next.fuelSeconds,
    capacitySeconds: next.capacitySeconds,
    waveCooldownTicks: next.waveCooldownTicks,
    kaEchoCooldownTicks: next.kaEchoCooldownTicks,
    waveActiveTicks: next.waveActiveTicks,
    kaEchoActiveTicks: next.kaEchoActiveTicks,
    placed: next.state === 'PLACED',
  };
}

export function emitTorchEvents(
  queue: DomainEventQueue,
  previous: TorchRuntime,
  result: TorchStepResult,
  position?: GameplayEventPosition,
): void {
  const next = result.runtime;
  const stateChanged =
    previous.state !== next.state ||
    previous.fuelSeconds !== next.fuelSeconds ||
    previous.waveCooldownTicks !== next.waveCooldownTicks ||
    previous.kaEchoCooldownTicks !== next.kaEchoCooldownTicks ||
    previous.waveActiveTicks !== next.waveActiveTicks ||
    previous.kaEchoActiveTicks !== next.kaEchoActiveTicks ||
    previous.usedBrazierIds.length !== next.usedBrazierIds.length;

  if (stateChanged) {
    emitPositioned(queue, 'TORCH_STATE_CHANGED', position, torchStatePayload(previous, next));
  }

  for (const effect of result.effects) {
    switch (effect.kind) {
      case 'FUEL_EMPTY':
        emitPositioned(queue, 'TORCH_FUEL_EMPTY', position, {
          intensity: effect.intensity,
        });
        break;
      case 'FUEL_LOW':
        emitPositioned(queue, 'TORCH_FUEL_LOW', position, {
          intensity: effect.intensity,
          fuelSeconds: next.fuelSeconds,
          capacitySeconds: next.capacitySeconds,
        });
        break;
      case 'NOISE':
        emitPositioned(queue, 'NOISE_PULSE', position, {
          source: 'torch',
          intensity: effect.intensity,
          brazierId: effect.brazierId,
        });
        break;
      case 'LIGHT_PULSE':
        emitPositioned(queue, 'LIGHT_PULSE', position, {
          intensity: effect.intensity,
        });
        break;
      case 'KA_ECHO_PULSE':
        emitPositioned(queue, 'KA_ECHO_PULSE', position, {
          intensity: effect.intensity,
          activeTicks: next.kaEchoActiveTicks,
        });
        break;
      case 'BRAZIER_LIT':
        emitPositioned(queue, 'BRAZIER_LIT', position, {
          source: 'torch',
          intensity: effect.intensity,
          brazierId: effect.brazierId,
        });
        break;
    }
  }
}

export function emitBrazierEvents(
  queue: DomainEventQueue,
  effects: readonly BrazierEffect[],
  position?: GameplayEventPosition,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'BRAZIER_LIT':
        emitPositioned(queue, 'BRAZIER_LIT', position, {
          brazierId: effect.brazierId,
          roomId: effect.roomId,
          value: effect.value,
        });
        break;
      case 'DARKNESS_RELIEF':
        emitPositioned(queue, 'DARKNESS_RELIEF', position, {
          brazierId: effect.brazierId,
          roomId: effect.roomId,
          value: effect.value,
        });
        break;
      case 'MAP_REVEAL':
        emitPositioned(queue, 'MAP_REVEAL', position, {
          brazierId: effect.brazierId,
          roomId: effect.roomId,
          value: effect.value,
        });
        break;
    }
  }
}

export function emitDigEvents(
  queue: DomainEventQueue,
  event: DigEvent,
  position?: GameplayEventPosition,
): void {
  const basePayload = {
    siteId: event.siteId,
    segmentIndex: event.segmentIndex,
    noiseIntensity: event.noiseIntensity,
  };

  switch (event.kind) {
    case 'SEGMENT_COMPLETE':
      emitPositioned(queue, 'DIG_PROGRESS', position, basePayload);
      emitPositioned(queue, 'NOISE_PULSE', position, {
        source: 'dig',
        intensity: event.noiseIntensity,
        siteId: event.siteId,
      });
      break;
    case 'DIG_COMPLETE':
      emitPositioned(queue, 'DIG_COMPLETE', position, basePayload);
      // G-05: TREASURE_FOUND NON parte qui — il tesoro è un reliquiario
      // fisico che il player raccoglie con E (loot nel mondo, pickup reale).
      emitPositioned(queue, 'NOISE_PULSE', position, {
        source: 'dig',
        intensity: event.noiseIntensity,
        siteId: event.siteId,
      });
      break;
    case 'NOISE_PULSE':
      emitPositioned(queue, 'NOISE_PULSE', position, {
        source: 'dig',
        intensity: event.noiseIntensity,
        siteId: event.siteId,
      });
      break;
  }
}
