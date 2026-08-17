import { describe, expect, it } from 'vitest';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';

describe('HitRegistry', () => {
  it('primo registro accettato', () => {
    const reg = new HitRegistry();
    const ok = reg.register(
      { attackerId: 1 as EntityId, attackId: 'slash', activeStartTick: 100 },
      2 as EntityId,
    );
    expect(ok).toBe(true);
    expect(reg.size).toBe(1);
  });

  it('secondo registro stesso swing rifiutato', () => {
    const reg = new HitRegistry();
    const record = { attackerId: 1 as EntityId, attackId: 'slash', activeStartTick: 100 };
    reg.register(record, 2 as EntityId);
    const ok = reg.register(record, 2 as EntityId);
    expect(ok).toBe(false);
  });

  it('bersagli diversi accettati nello stesso swing', () => {
    const reg = new HitRegistry();
    const record = { attackerId: 1 as EntityId, attackId: 'slash', activeStartTick: 100 };
    expect(reg.register(record, 2 as EntityId)).toBe(true);
    expect(reg.register(record, 3 as EntityId)).toBe(true);
    expect(reg.size).toBe(2);
  });

  it('clear azzera tutti i record', () => {
    const reg = new HitRegistry();
    reg.register(
      { attackerId: 1 as EntityId, attackId: 'slash', activeStartTick: 100 },
      2 as EntityId,
    );
    reg.clear();
    expect(reg.size).toBe(0);
  });

  it('stesso bersaglio in swing diverso è accettato', () => {
    const reg = new HitRegistry();
    reg.register(
      { attackerId: 1 as EntityId, attackId: 'slash', activeStartTick: 100 },
      2 as EntityId,
    );
    const ok = reg.register(
      { attackerId: 1 as EntityId, attackId: 'slash', activeStartTick: 200 },
      2 as EntityId,
    );
    expect(ok).toBe(true);
  });
});
