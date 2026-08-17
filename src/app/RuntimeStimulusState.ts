/**
 * Scopo: tenere traccia degli stimoli runtime a breve durata derivati dai
 * DomainEvent, così i consumer AI possono reagire senza conoscere la coda eventi.
 * Ownership: GameApplication.
 */

import { secondsToTicks } from '@/content/balance.js';
import type { DomainEvent } from '@/simulation/DomainEventQueue.js';

const NOISE_STIMULUS_TICKS = secondsToTicks(2.0);
const KA_ECHO_STIMULUS_TICKS = secondsToTicks(3.0);

export interface RuntimeStimulus {
  readonly kind: 'noise' | 'ka_echo';
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly ticksRemaining: number;
  readonly intensity: number;
}

export interface RuntimeStimulusState {
  readonly activeStimulus: RuntimeStimulus | null;
}

export interface RuntimeStimulusEventApplication {
  readonly state: RuntimeStimulusState;
  readonly changed: boolean;
}

export function createRuntimeStimulusState(): RuntimeStimulusState {
  return {
    activeStimulus: null,
  };
}

function unchanged(state: RuntimeStimulusState): RuntimeStimulusEventApplication {
  return {
    state,
    changed: false,
  };
}

function readIntensity(event: DomainEvent): number {
  const value = event.data?.intensity;
  return typeof value === 'number' && Number.isFinite(value) ? value : 1;
}

function eventPosition(event: DomainEvent): RuntimeStimulus['position'] | null {
  return event.position ?? null;
}

export function applyRuntimeStimulusEvent(
  state: RuntimeStimulusState,
  event: DomainEvent,
): RuntimeStimulusEventApplication {
  if (event.kind !== 'NOISE_PULSE' && event.kind !== 'KA_ECHO_PULSE') {
    return unchanged(state);
  }

  const position = eventPosition(event);
  if (!position) {
    return unchanged(state);
  }

  return {
    state: {
      activeStimulus: {
        kind: event.kind === 'KA_ECHO_PULSE' ? 'ka_echo' : 'noise',
        position,
        ticksRemaining:
          event.kind === 'KA_ECHO_PULSE' ? KA_ECHO_STIMULUS_TICKS : NOISE_STIMULUS_TICKS,
        intensity: readIntensity(event),
      },
    },
    changed: true,
  };
}

export function tickRuntimeStimulusState(
  state: RuntimeStimulusState,
): RuntimeStimulusState {
  const activeStimulus = state.activeStimulus;
  if (!activeStimulus) {
    return state;
  }

  if (activeStimulus.ticksRemaining <= 1) {
    return { activeStimulus: null };
  }

  return {
    activeStimulus: {
      ...activeStimulus,
      ticksRemaining: activeStimulus.ticksRemaining - 1,
    },
  };
}
