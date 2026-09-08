import { describe, it, expect } from 'vitest';
import { createPharaohBoss, tickPharaohBoss } from '../../src/gameplay/enemies/OsirisPharaohBoss';

describe('OsirisPharaohBoss', () => {
  it('istanzia il Faraone in Fase 1 con 650 HP', () => {
    const boss = createPharaohBoss(0, 0, 0);
    expect(boss.hp).toBe(650);
    expect(boss.phase).toBe(1);
  });

  it('transiziona a Fase 2 sotto il 66% degli HP', () => {
    const boss = createPharaohBoss(0, 0, 0);
    boss.hp = 400; // < 66%
    const res = tickPharaohBoss(boss, { x: 0, y: 0, z: 2 }, 0.1);
    expect(boss.phase).toBe(2);
    expect(res.phaseChanged).toBe(true);
    expect(res.triggerSandstorm).toBe(true);
  });

  it('transiziona a Fase 3 sotto il 33% degli HP', () => {
    const boss = createPharaohBoss(0, 0, 0);
    boss.phase = 2;
    boss.hp = 180; // < 33%
    const res = tickPharaohBoss(boss, { x: 0, y: 0, z: 2 }, 0.1);
    expect(boss.phase).toBe(3);
    expect(res.phaseChanged).toBe(true);
  });
});
