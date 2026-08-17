import { createGenericEncounterState, tickGenericEncounter } from '@/gameplay/enemies/GenericEncounterRuntime.js';

const state = createGenericEncounterState(100 as never, 'COBRA', { x: 0, y: 0, z: 0.9 });
let dmg = 0;
for (let i = 0; i < 60; i++) {
  const r = tickGenericEncounter(state as never, {
    playerPosition: { x: 0, y: 0, z: 0 },
    playerYaw: 0,
    tick: i,
    hasLineOfSight: null,
    torchLit: false,
  } as never);
  if (r.playerDamageHp > 0) dmg += r.playerDamageHp;
  console.log(
    i,
    state.runtime.state,
    'facing', state.facingDeg.toFixed(1),
    'posZ', state.position.z.toFixed(2),
    'dmg', dmg,
    'ticks', state.runtime.stateTicks,
    'msg', r.message,
  );
}
