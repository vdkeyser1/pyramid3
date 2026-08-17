import { describe, expect, it } from 'vitest';
import { deriveEventFeedback } from '@/app/AudioEventDirector.js';
import type { DomainEvent } from '@/simulation/DomainEventQueue.js';

describe('AudioEventDirector', () => {
  it('mappa il warning torcia a cue e indicatore testuale', () => {
    const event: DomainEvent = {
      kind: 'TORCH_FUEL_LOW',
      data: { fuelSeconds: 14.8, capacitySeconds: 180 },
    };

    expect(deriveEventFeedback(event)).toEqual({
      cue: { name: 'torch_low_warning', volume: 0.9 },
      indicatorText: 'Torcia quasi esaurita',
    });
  });

  it('deriva la direzione per eventi posizionati rispetto al listener', () => {
    const event: DomainEvent = {
      kind: 'BRAZIER_LIT',
      position: { x: 4, y: 0.35, z: 0 },
    };

    const feedback = deriveEventFeedback(event, { x: 0, z: 0 });
    expect(feedback.cue?.name).toBe('brazier_ignite');
    expect(feedback.indicatorText).toBe('Braciere acceso a destra');
  });

  it('non genera feedback per eventi non mappati', () => {
    const feedback = deriveEventFeedback({ kind: 'ROOM_ENTERED' });
    expect(feedback.cue).toBeNull();
    expect(feedback.indicatorText).toBeNull();
  });
});
