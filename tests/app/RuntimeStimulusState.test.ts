import { describe, expect, it } from 'vitest';
import {
  applyRuntimeStimulusEvent,
  createRuntimeStimulusState,
  tickRuntimeStimulusState,
} from '@/app/RuntimeStimulusState.js';

describe('RuntimeStimulusState', () => {
  it('registra un NOISE_PULSE con posizione e lo fa decadere', () => {
    const applied = applyRuntimeStimulusEvent(createRuntimeStimulusState(), {
      kind: 'NOISE_PULSE',
      position: { x: 4, y: 0.02, z: 6 },
      data: { intensity: 2 },
    });

    expect(applied.changed).toBe(true);
    expect(applied.state.activeStimulus?.kind).toBe('noise');
    expect(applied.state.activeStimulus?.position.x).toBe(4);

    let state = applied.state;
    while (state.activeStimulus) {
      state = tickRuntimeStimulusState(state);
    }

    expect(state.activeStimulus).toBeNull();
  });

  it('registra un KA_ECHO_PULSE come stimolo dedicato', () => {
    const applied = applyRuntimeStimulusEvent(createRuntimeStimulusState(), {
      kind: 'KA_ECHO_PULSE',
      position: { x: 1, y: 1, z: 2 },
      data: { intensity: 1 },
    });

    expect(applied.state.activeStimulus?.kind).toBe('ka_echo');
    expect(applied.state.activeStimulus?.ticksRemaining).toBeGreaterThan(100);
  });

  it('ignora eventi senza posizione o irrilevanti', () => {
    expect(
      applyRuntimeStimulusEvent(createRuntimeStimulusState(), {
        kind: 'NOISE_PULSE',
        data: { intensity: 2 },
      }).changed,
    ).toBe(false);

    expect(
      applyRuntimeStimulusEvent(createRuntimeStimulusState(), {
        kind: 'DIG_PROGRESS',
        position: { x: 0, y: 0, z: 0 },
      }).changed,
    ).toBe(false);
  });
});
