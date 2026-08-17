import { describe, expect, it } from 'vitest';
import {
  angleToEnemyDeg,
  isEnemyInParryArc,
  normalizeDeg,
  parryWindowActive,
  PARRY_ARC_DEG,
} from '@/gameplay/combat/ParryResolver.js';

describe('ParryResolver (parry system)', () => {
  it('parryWindowActive: vera solo entro la finestra', () => {
    expect(parryWindowActive(1000, 999)).toBe(true);
    expect(parryWindowActive(1000, 1000)).toBe(false); // scaduta al confine
    expect(parryWindowActive(1000, 1500)).toBe(false);
  });

  it('normalizeDeg porta gli angoli in [-180, 180)', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
    expect(normalizeDeg(190)).toBe(-170);
    expect(normalizeDeg(-190)).toBe(170);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(720)).toBe(0);
  });

  it('angleToEnemyDeg usa la convenzione yaw 0 = verso -z', () => {
    const player = { x: 0, z: 0 };
    // Nemico davanti (verso -z) ⇒ 0°
    expect(Math.abs(angleToEnemyDeg(player, { x: 0, z: -5 }))).toBe(0);
    // Nemico dietro (verso +z) ⇒ ±180°
    expect(Math.abs(angleToEnemyDeg(player, { x: 0, z: 5 }))).toBe(180);
    // Nemico a destra (+x) ⇒ -90°
    expect(angleToEnemyDeg(player, { x: 5, z: 0 })).toBe(-90);
    // Nemico a sinistra (-x) ⇒ +90°
    expect(angleToEnemyDeg(player, { x: -5, z: 0 })).toBe(90);
  });

  it('isEnemyInParryArc: davanti sì, dietro no, bordi rispettati', () => {
    const player = { x: 0, z: 0 };
    // yaw 0 = guarda verso -z: il nemico a -z è in fronte
    expect(isEnemyInParryArc(0, player, { x: 0, z: -3 })).toBe(true);
    // Nemico dietro: fuori dall'arco
    expect(isEnemyInParryArc(0, player, { x: 0, z: 3 })).toBe(false);
    // Entro metà arco (50°): a 45° è ancora dentro
    expect(isEnemyInParryArc(0, player, { x: 3, z: -3 })).toBe(true);
    // Oltre metà arco: a 60° è fuori
    expect(isEnemyInParryArc(0, player, { x: 3.464, z: -2 })).toBe(false);
    // Arc personalizzato più largo: 60° dentro con arcDeg 140
    expect(isEnemyInParryArc(0, player, { x: 3.464, z: -2 }, 140)).toBe(true);
  });

  it('isEnemyInParryArc: simmetria attorno allo yaw del player', () => {
    const player = { x: 0, z: 0 };
    // Convenzione three.js: yaw +90° (antiorario da -z) ⇒ si guarda verso -x.
    expect(isEnemyInParryArc(Math.PI / 2, player, { x: -3, z: 0 })).toBe(true);
    // Yaw -90° ⇒ si guarda verso +x.
    expect(isEnemyInParryArc(-Math.PI / 2, player, { x: 3, z: 0 })).toBe(true);
    // Yaw 180° (verso +z): il nemico a +z è in fronte...
    expect(isEnemyInParryArc(Math.PI, player, { x: 0, z: 3 })).toBe(true);
    // ...ma quello a -z ora è alle spalle
    expect(isEnemyInParryArc(Math.PI, player, { x: 0, z: -3 })).toBe(false);
  });

  it('l arco di default copre esattamente PARRY_ARC_DEG', () => {
    expect(PARRY_ARC_DEG).toBe(100);
  });
});
