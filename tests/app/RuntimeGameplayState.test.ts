import { describe, expect, it } from 'vitest';
import {
  applyRuntimeGameplayEvent,
  createRuntimeGameplayState,
} from '@/app/RuntimeGameplayState.js';

describe('RuntimeGameplayState', () => {
  it('parte con oscurita di baseline e nessuna stanza rivelata', () => {
    const state = createRuntimeGameplayState();

    expect(state.darknessLevel).toBe(22);
    expect(state.revealedRoomIds).toEqual([]);
  });

  it('applica DARKNESS_RELIEF riducendo l oscurita senza andare sotto zero', () => {
    const first = applyRuntimeGameplayEvent(createRuntimeGameplayState(), {
      kind: 'DARKNESS_RELIEF',
      data: { value: 8 },
    });
    const second = applyRuntimeGameplayEvent(first.state, {
      kind: 'DARKNESS_RELIEF',
      data: { value: 99 },
    });

    expect(first.changed).toBe(true);
    expect(first.darknessReliefApplied).toBe(8);
    expect(first.state.darknessLevel).toBe(14);
    expect(second.state.darknessLevel).toBe(0);
    expect(second.darknessReliefApplied).toBe(14);
  });

  it('registra MAP_REVEAL una sola volta per stanza', () => {
    const first = applyRuntimeGameplayEvent(createRuntimeGameplayState(), {
      kind: 'MAP_REVEAL',
      data: { roomId: 7 },
    });
    const second = applyRuntimeGameplayEvent(first.state, {
      kind: 'MAP_REVEAL',
      data: { roomId: 7 },
    });

    expect(first.changed).toBe(true);
    expect(first.revealedRoomId).toBe(7);
    expect(first.state.revealedRoomIds).toEqual([7]);
    expect(second.changed).toBe(false);
    expect(second.state.revealedRoomIds).toEqual([7]);
  });

  it('ignora payload malformati o eventi irrilevanti', () => {
    const state = createRuntimeGameplayState();

    expect(
      applyRuntimeGameplayEvent(state, {
        kind: 'DARKNESS_RELIEF',
        data: { value: 'oops' },
      }).changed,
    ).toBe(false);
    expect(
      applyRuntimeGameplayEvent(state, {
        kind: 'MAP_REVEAL',
        data: {},
      }).changed,
    ).toBe(false);
    expect(
      applyRuntimeGameplayEvent(state, {
        kind: 'NOISE_PULSE',
        data: { intensity: 2 },
      }).changed,
    ).toBe(false);
  });

  it('accumula oro su ENEMY_DIED e lo espone come goldAdded', () => {
    const first = applyRuntimeGameplayEvent(createRuntimeGameplayState(), {
      kind: 'ENEMY_DIED',
      data: { archetype: 'SCARAB', goldDropped: 12 },
    });
    const second = applyRuntimeGameplayEvent(first.state, {
      kind: 'ENEMY_DIED',
      data: { archetype: 'MUMMY', goldDropped: 8 },
    });

    expect(first.changed).toBe(true);
    expect(first.goldAdded).toBe(12);
    expect(first.state.goldCoins).toBe(12);
    expect(second.goldAdded).toBe(8);
    expect(second.state.goldCoins).toBe(20);
  });

  it('ignora ENEMY_DIED senza oro o con oro non valido', () => {
    const state = createRuntimeGameplayState();

    const withoutGold = applyRuntimeGameplayEvent(state, {
      kind: 'ENEMY_DIED',
      data: { archetype: 'SCARAB' },
    });
    const invalidGold = applyRuntimeGameplayEvent(state, {
      kind: 'ENEMY_DIED',
      data: { archetype: 'SCARAB', goldDropped: -3 },
    });

    expect(withoutGold.changed).toBe(false);
    expect(invalidGold.changed).toBe(false);
    expect(withoutGold.state.goldCoins).toBe(0);
  });
});
