import { describe, expect, it } from 'vitest';
import {
  emitBrazierEvents,
  emitDigEvents,
  emitTorchEvents,
} from '@/app/GameplayEventBridge.js';
import { DIGGING } from '@/content/balance.js';
import { createDigSite, tickDig } from '@/gameplay/digging/DiggingSystem.js';
import { createBrazier, igniteBrazier } from '@/gameplay/torch/BrazierSystem.js';
import { applyTorchCommand, createTorch, tickTorch } from '@/gameplay/torch/TorchSystem.js';
import { createDomainEventQueue } from '@/simulation/DomainEventQueue.js';

describe('GameplayEventBridge', () => {
  it('traduce il Ka Echo in eventi di dominio consumabili', () => {
    const queue = createDomainEventQueue();
    const previous = { ...createTorch(), state: 'HIGH' as const };
    const result = applyTorchCommand(previous, { kind: 'KA_ECHO' });

    emitTorchEvents(queue, previous, result, { x: 4, y: 1, z: 6 });

    const events = queue.flush();
    expect(events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(['TORCH_STATE_CHANGED', 'KA_ECHO_PULSE', 'NOISE_PULSE']),
    );
    expect(events.find((event) => event.kind === 'NOISE_PULSE')?.data?.intensity).toBe(4);
  });

  it('propaga il warning low-fuel con payload leggibile da HUD/audio', () => {
    const queue = createDomainEventQueue();
    const thresholdEdge = 15 + 0.5 / 60;
    const previous = { ...createTorch(), state: 'HIGH' as const, fuelSeconds: thresholdEdge };
    const result = tickTorch(previous);

    emitTorchEvents(queue, previous, result, { x: 1, y: 0.5, z: 2 });

    const lowFuelEvent = queue.flush().find((event) => event.kind === 'TORCH_FUEL_LOW');
    expect(lowFuelEvent).toBeDefined();
    expect(lowFuelEvent?.data?.fuelSeconds).toBe(result.runtime.fuelSeconds);
    expect(lowFuelEvent?.data?.capacitySeconds).toBe(result.runtime.capacitySeconds);
  });

  it('propaga gli effetti del braciere come eventi separati', () => {
    const queue = createDomainEventQueue();
    const brazier = createBrazier('b-1', 7);
    const ignition = igniteBrazier(brazier, 90);
    expect(ignition).not.toBeNull();
    if (!ignition) {
      throw new Error('Expected brazier ignition');
    }

    emitBrazierEvents(queue, ignition.effects, { x: 8, y: 0.35, z: 2 });

    expect(queue.flush().map((event) => event.kind)).toEqual([
      'BRAZIER_LIT',
      'DARKNESS_RELIEF',
      'MAP_REVEAL',
    ]);
  });

  it('emette progresso e rumore durante lo scavo — il tesoro resta al pickup fisico', () => {
    const queue = createDomainEventQueue();
    const site = createDigSite('dig-1', 3, 10, 20);
    let completeEvent = null;

    for (let i = 0; i < DIGGING.totalDurationTicks; i++) {
      const event = tickDig(site, true);
      if (event?.kind === 'DIG_COMPLETE') {
        completeEvent = event;
      }
    }

    expect(completeEvent).not.toBeNull();
    if (!completeEvent) {
      throw new Error('Expected DIG_COMPLETE event');
    }

    emitDigEvents(queue, completeEvent, { x: site.positionX, y: 0.02, z: site.positionZ });

    // G-05: TREASURE_FOUND NON parte da DIG_COMPLETE — il tesoro è un
    // reliquiario fisico che il player raccoglie con E (pickup reale).
    const kinds = queue.flush().map((event) => event.kind);
    expect(kinds).toEqual(['DIG_COMPLETE', 'NOISE_PULSE']);
    expect(kinds).not.toContain('TREASURE_FOUND');
  });
});
