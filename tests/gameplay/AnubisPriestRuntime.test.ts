import { describe, it, expect } from 'vitest';
import { createPriestInstance, tickPriestAI } from '../../src/gameplay/enemies/AnubisPriestRuntime';

describe('AnubisPriestRuntime', () => {
  it('crea un sacerdote con HP corretti e stato IDLE', () => {
    const priest = createPriestInstance(0, 0, 0);
    expect(priest.hp).toBe(220);
    expect(priest.state).toBe('IDLE');
  });

  it('scaglia un dardo d ombra quando il cooldown si azzera', () => {
    const priest = createPriestInstance(0, 0, 0);
    priest.castCooldownSec = 0;
    const res = tickPriestAI(priest, { x: 0, y: 0, z: 5 }, 0.1);
    expect(res.damageDealtToPlayer).toBe(18);
    expect(priest.state).toBe('CAST_DUAT_BOLT');
  });

  it('si teletrasporta quando il player è troppo vicino', () => {
    const priest = createPriestInstance(0, 0, 0);
    priest.teleportCooldownSec = 0;
    const res = tickPriestAI(priest, { x: 0, y: 0, z: 1.5 }, 0.1);
    expect(res.teleportedTo).toBeDefined();
    expect(priest.state).toBe('TELEPORT');
  });
});
