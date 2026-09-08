import { describe, expect, it } from 'vitest';
import { createYukaEnemyAI, yukaStateFromRuntime } from '@/ai/steering/YukaEnemyAI.js';

describe('YukaEnemyAI (G-32)', () => {
  it('mappa gli stati encounter su steering Yuka', () => {
    expect(yukaStateFromRuntime('DORMANT')).toBe('DORMANT');
    expect(yukaStateFromRuntime('PURSUING')).toBe('ENGAGE');
    expect(yukaStateFromRuntime('SEARCH')).toBe('SEARCH');
    expect(yukaStateFromRuntime('FLEE')).toBe('FLEE');
    expect(yukaStateFromRuntime('DEAD')).toBe('DEATH');
  });

  it('spawna un veicolo e aggiorna senza lanciare', () => {
    const ai = createYukaEnemyAI();
    const pos = { x: 0, y: 0, z: 0 };
    const handle = ai.spawn(1, pos, 1.8);
    ai.setPlayerPosition({ x: 4, y: 0, z: 0 });
    handle.setState('ENGAGE');
    ai.update(0.05);
    const out = { x: 0, y: 0, z: 0 };
    handle.syncTo(out);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.z)).toBe(true);
    ai.clear();
  });
});
