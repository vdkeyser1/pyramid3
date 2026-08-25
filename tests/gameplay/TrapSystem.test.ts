/**
 * ART-006 — Test della macchina a stati TrapSystem.
 *
 * Scopo: verificare in Node (senza DOM, senza THREE) che TrapSystem aggiorni
 *   correttamente gli stati di piastre, pendoli e leva, e calcoli il danno
 *   in modo deterministico.
 * Ownership: test. Dipende solo da TrapSystem e TRAPS; nessuna dipendenza
 *   dal renderer.
 * Invarianti:
 *   - nessun Math.random(), nessun performance.now();
 *   - i tick registrati nelle asserzioni derivano da TRAPS tramite
 *     secondsToTicks(seconds) = Math.round(seconds * 60), così i valori
 *     restano coerenti se balance.ts cambia;
 *   - gli animator vengono registrati come spy: verificano che le callback
 *     vengano chiamate senza dipendere da Three.js.
 * Note sui tick calcolati:
 *   extendTicks   = round(0.15 × 60) = 9
 *   holdTicks     = round(1.2  × 60) = 72
 *   retractTicks  = round(0.40 × 60) = 24
 *   cooldownTicks = round(4.0  × 60) = 240
 *   hitCooldownTicks   = round(1.3 × 60) = 78
 *   pullDurationTicks  = round(0.9 × 60) = 54
 *   sealDropTicks      = round(2.0 × 60) = 120
 */

import { describe, it, expect } from 'vitest';
import { TRAPS } from '@/content/balance.js';
import { TrapSystem } from '@/gameplay/TrapSystem.js';
import type { FloorSceneLeverPassage, FloorSceneTrap } from '@/world/FloorSceneLayout.js';

// ---------------------------------------------------------------------------
// Helpers di costruzione dei fixture
// ---------------------------------------------------------------------------

/** Crea un FloorSceneTrap di tipo piastra a pressione centrata in (0,0). */
function makePressurePlate(id = 'pp-1'): FloorSceneTrap {
  return {
    trapId: id,
    kind: 'pressurePlate',
    position: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Crea un FloorSceneTrap di tipo pendolo a lama centrato in (0,0)
 * su un corridoio asse X.
 */
function makePendulum(id = 'bl-1', axis: 'x' | 'z' = 'x'): FloorSceneTrap {
  return {
    trapId: id,
    kind: 'bladePendulum',
    position: { x: 0, y: 0, z: 0 },
    corridorAxis: axis,
    corridorLengthM: 10,
  };
}

/** Crea un FloorSceneLeverPassage con leva in (5,0,5) e sigillo in (5,0,3). */
function makeLeverPassage(id = 'lev-1'): FloorSceneLeverPassage {
  return {
    leverId: id,
    leverPosition: { x: 5, y: 0, z: 5 },
    sealPosition:  { x: 5, y: TRAPS.lever.sealDropM / 2, z: 3 },
    sealWidthM:  1.0,
    sealDepthM:  0.4,
  };
}

// ---------------------------------------------------------------------------
// Piastra a pressione — macchina a stati
// ---------------------------------------------------------------------------

describe('TrapSystem – piastra a pressione', () => {
  it("è in stato ARMED all'inizio", () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    const snap = sys.getSnapshot();
    expect(snap.traps[0]!.state).toBe('ARMED');
    expect(snap.traps[0]!.timerTicks).toBe(0);
  });

  it('non infligge danno quando il giocatore è lontano', () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    // Giocatore a 2 m di distanza: fuori dal raggio (0.55 m).
    const dmg = sys.tick(2, 0);
    expect(dmg).toBe(0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('ARMED');
  });

  it('infligge danno (damageHp) e passa a EXTEND quando il giocatore entra nel raggio', () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    // Giocatore a 0.1 m — dentro il raggio di attivazione (0.55 m).
    const dmg = sys.tick(0.1, 0);
    expect(dmg).toBe(TRAPS.pressurePlate.damageHp);
    expect(sys.getSnapshot().traps[0]!.state).toBe('EXTEND');
    expect(sys.getSnapshot().traps[0]!.timerTicks).toBe(TRAPS.pressurePlate.extendTicks);
  });

  it('non infligge danno extra durante EXTEND', () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    sys.tick(0.1, 0); // → EXTEND, danno = damageHp
    // Il giocatore rimane in zona, ma la trappola è in EXTEND: nessun danno aggiuntivo.
    for (let i = 0; i < TRAPS.pressurePlate.extendTicks; i++) {
      const dmg = sys.tick(0.1, 0);
      expect(dmg).toBe(0);
    }
    expect(sys.getSnapshot().traps[0]!.state).toBe('HOLD');
  });

  it('ciclo completo ARMED → EXTEND → HOLD → RETRACT → COOLDOWN → ARMED', () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    const p = TRAPS.pressurePlate;

    // ARMED → EXTEND (tick 1, giocatore vicino)
    sys.tick(0.1, 0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('EXTEND');

    // EXTEND → HOLD (dopo extendTicks tick aggiuntivi con giocatore lontano)
    for (let i = 0; i < p.extendTicks; i++) sys.tick(10, 0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('HOLD');

    // HOLD → RETRACT (dopo holdTicks tick)
    for (let i = 0; i < p.holdTicks; i++) sys.tick(10, 0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('RETRACT');

    // RETRACT → COOLDOWN (dopo retractTicks tick)
    for (let i = 0; i < p.retractTicks; i++) sys.tick(10, 0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('COOLDOWN');

    // COOLDOWN → ARMED (dopo cooldownTicks tick)
    for (let i = 0; i < p.cooldownTicks; i++) sys.tick(10, 0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('ARMED');
    expect(sys.getSnapshot().traps[0]!.timerTicks).toBe(0);
  });

  it('non si attiva durante COOLDOWN anche se il giocatore è nel raggio', () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    const p = TRAPS.pressurePlate;

    sys.tick(0.1, 0); // ARMED → EXTEND
    for (let i = 0; i < p.extendTicks + p.holdTicks + p.retractTicks; i++) sys.tick(10, 0);
    // Ora è COOLDOWN
    expect(sys.getSnapshot().traps[0]!.state).toBe('COOLDOWN');

    // Il giocatore calpesta la piastra durante il cooldown: nessun danno, stato invariato
    const dmg = sys.tick(0, 0);
    expect(dmg).toBe(0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('COOLDOWN');
  });

  it('si riattiva dopo il cooldown completo e può infliggere danno di nuovo', () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    const p = TRAPS.pressurePlate;

    sys.tick(0.1, 0); // ARMED → EXTEND
    for (let i = 0; i < p.extendTicks + p.holdTicks + p.retractTicks + p.cooldownTicks; i++) {
      sys.tick(10, 0);
    }
    expect(sys.getSnapshot().traps[0]!.state).toBe('ARMED');

    const dmg2 = sys.tick(0.1, 0);
    expect(dmg2).toBe(p.damageHp);
    expect(sys.getSnapshot().traps[0]!.state).toBe('EXTEND');
  });

  it("chiama l'animator durante EXTEND con progresso lineare crescente", () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    const spikesYValues: number[] = [];
    sys.registerPressurePlateAnimator('pp-1', (y) => spikesYValues.push(y));

    sys.tick(0.1, 0); // ARMED → EXTEND, animator chiamato con y ancora crescente

    // Durante EXTEND timerTicks decresce da extendTicks-1 a 0.
    // progress = 1 - timerTicks / extendTicks → y cresce verso spikeHeightM.
    for (let i = 0; i < TRAPS.pressurePlate.extendTicks; i++) sys.tick(10, 0);

    // Le ultime due chiamate di EXTEND devono essere crescenti.
    const extendSlice = spikesYValues.slice(1, 1 + TRAPS.pressurePlate.extendTicks);
    for (let i = 1; i < extendSlice.length; i++) {
      expect(extendSlice[i]!).toBeGreaterThanOrEqual(extendSlice[i - 1]!);
    }
    // Durante HOLD l'animator deve restituire esattamente spikeHeightM.
    // Indice: [0]=primo tick EXTEND, [1..extendTicks]=tick lontani (l'ultimo è HOLD).
    const holdY = spikesYValues[TRAPS.pressurePlate.extendTicks];
    expect(holdY).toBeCloseTo(TRAPS.pressurePlate.spikeHeightM);
  });
});

// ---------------------------------------------------------------------------
// Pendolo a lama — oscillazione e danno
// ---------------------------------------------------------------------------

describe('TrapSystem – pendolo a lama', () => {
  it('non infligge danno quando il giocatore è lontano', () => {
    const sys = new TrapSystem([makePendulum()], null);
    // Pendolo centrato in (0,0); giocatore a 5 m: fuori dal raggio (0.6 m).
    for (let i = 0; i < 200; i++) {
      expect(sys.tick(5, 0)).toBe(0);
    }
  });

  it('infligge danno quando il giocatore è nella zona della lama', () => {
    const sys = new TrapSystem([makePendulum()], null);
    // Il pendolo oscilla su Z (corridorAxis = 'x').
    // bladeOffset = armLengthM * sin(angle); quando elapsedTicks = 0 l'angolo è 0
    // → bladeZ = 0 → giocatore in (0, 0) è esattamente sulla lama.
    // Al tick 1 sin è quasi zero ma diverso da zero; il test spazia su più tick
    // cercandone uno in cui la punta supera il giocatore a (0, 0).
    let totalDmg = 0;
    for (let i = 0; i < TRAPS.bladePendulum.swingPeriodTicks * 2; i++) {
      totalDmg += sys.tick(0, 0);
    }
    expect(totalDmg).toBeGreaterThan(0);
  });

  it('rispetta hitCooldownTicks: al massimo un colpo per cooldown', () => {
    const sys = new TrapSystem([makePendulum()], null);
    let hits = 0;
    let prevHit = false;
    // Giocatore fermo sulla lama: viene colpito solo ogni hitCooldownTicks tick.
    for (let i = 0; i < TRAPS.bladePendulum.hitCooldownTicks * 4; i++) {
      const dmg = sys.tick(0, 0);
      if (dmg > 0) {
        if (prevHit) {
          // Due colpi consecutivi senza cooldown — errore.
          expect(false).toBe(true);
        }
        hits++;
        prevHit = true;
      } else {
        prevHit = false;
      }
    }
    // Deve esserci almeno un colpo (il pendolo passa sicuramente sul giocatore).
    expect(hits).toBeGreaterThanOrEqual(1);
  });

  it("chiama l'animator del pendolo ad ogni tick", () => {
    const sys = new TrapSystem([makePendulum()], null);
    const angles: number[] = [];
    sys.registerPendulumAnimator('bl-1', (a) => angles.push(a));

    for (let i = 0; i < 10; i++) sys.tick(10, 0);
    // 10 tick → 10 chiamate all'animator.
    expect(angles).toHaveLength(10);
    // Gli angoli devono variare (oscillazione sinusoidale, non sempre 0).
    const distinct = new Set(angles.map((a) => Math.round(a * 1000)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('pendolo su asse z oscilla su X anziché su Z', () => {
    // corridorAxis = 'z': bladeX = posX + bladeOffset, bladeZ = posZ (fisso).
    // Giocatore a (0, 0): la lama lo colpisce quando bladeOffset ≈ 0 su X.
    const sys = new TrapSystem([makePendulum('bl-z', 'z')], null);
    let totalDmg = 0;
    for (let i = 0; i < TRAPS.bladePendulum.swingPeriodTicks * 2; i++) {
      totalDmg += sys.tick(0, 0);
    }
    expect(totalDmg).toBeGreaterThan(0);
  });

  it('il pendolo non ha stati discreti: si aggiorna sempre senza timerTicks', () => {
    const sys = new TrapSystem([makePendulum()], null);
    // I pendoli non usano timerTicks né state come le piastre; lo snapshot
    // deve mostrare state = 'ARMED' (valore iniziale, mai modificato dal pendolo).
    sys.tick(10, 0);
    expect(sys.getSnapshot().traps[0]!.state).toBe('ARMED');
  });
});

// ---------------------------------------------------------------------------
// Meccanismo leva — stati e animazione sigillo
// ---------------------------------------------------------------------------

describe('TrapSystem – meccanismo leva', () => {
  it('getLeverState() restituisce null senza lever passage', () => {
    const sys = new TrapSystem([], null);
    expect(sys.getLeverState()).toBeNull();
  });

  it("getLeverState() restituisce READY all'inizio", () => {
    const sys = new TrapSystem([], makeLeverPassage());
    expect(sys.getLeverState()).toBe('READY');
  });

  it('tryActivateLever restituisce false se il giocatore è troppo lontano', () => {
    const sys = new TrapSystem([], makeLeverPassage());
    // Leva in (5,5); giocatore in (0,0): distanza ≈ 7.07 m > interactionRadiusM (1.4 m).
    expect(sys.tryActivateLever(0, 0)).toBe(false);
    expect(sys.getLeverState()).toBe('READY');
  });

  it('tryActivateLever restituisce true e passa a PULLING quando il giocatore è vicino', () => {
    const sys = new TrapSystem([], makeLeverPassage());
    // Leva in (5,5); giocatore in (5, 5.5): distanza 0.5 m < 1.4 m.
    const activated = sys.tryActivateLever(5, 5.5);
    expect(activated).toBe(true);
    expect(sys.getLeverState()).toBe('PULLING');
  });

  it('tryActivateLever restituisce false se la leva è già PULLING', () => {
    const sys = new TrapSystem([], makeLeverPassage());
    sys.tryActivateLever(5, 5.5); // → PULLING
    expect(sys.tryActivateLever(5, 5.5)).toBe(false);
  });

  it('dopo pullDurationTicks tick passa da PULLING a PULLED', () => {
    const sys = new TrapSystem([], makeLeverPassage());
    sys.tryActivateLever(5, 5.5);

    for (let i = 0; i < TRAPS.lever.pullDurationTicks; i++) {
      sys.tick(5, 5.5);
    }
    expect(sys.getLeverState()).toBe('PULLED');
    expect(sys.getSnapshot().lever!.sealDropProgress).toBe(0);
  });

  it('sealDropProgress avanza da 0 a 1 durante sealDropTicks tick in PULLED', () => {
    const sys = new TrapSystem([], makeLeverPassage());
    sys.tryActivateLever(5, 5.5);

    // Completa la fase PULLING.
    for (let i = 0; i < TRAPS.lever.pullDurationTicks; i++) sys.tick(5, 5.5);
    expect(sys.getLeverState()).toBe('PULLED');

    // Campiona progress durante la fase PULLED.
    const progressSamples: number[] = [];
    for (let i = 0; i < TRAPS.lever.sealDropTicks; i++) {
      sys.tick(10, 10);
      progressSamples.push(sys.getSnapshot().lever!.sealDropProgress);
    }

    // Il primo sample deve essere > 0, l'ultimo deve essere 1.
    expect(progressSamples[0]!).toBeGreaterThan(0);
    expect(progressSamples[progressSamples.length - 1]).toBe(1);

    // Progress deve essere monotonicamente crescente.
    for (let i = 1; i < progressSamples.length; i++) {
      expect(progressSamples[i]!).toBeGreaterThanOrEqual(progressSamples[i - 1]!);
    }
  });

  it('lo stato rimane PULLED anche dopo sealDropTicks: il passaggio è permanente', () => {
    const sys = new TrapSystem([], makeLeverPassage());
    sys.tryActivateLever(5, 5.5);

    for (let i = 0; i < TRAPS.lever.pullDurationTicks + TRAPS.lever.sealDropTicks + 60; i++) {
      sys.tick(10, 10);
    }
    expect(sys.getLeverState()).toBe('PULLED');
    expect(sys.getSnapshot().lever!.sealDropProgress).toBe(1);
  });

  it("l'animator della leva viene chiamato con handleAngle crescente durante PULLING", () => {
    const sys = new TrapSystem([], makeLeverPassage());
    const calls: { h: number; s: number }[] = [];
    sys.registerLeverAnimator((h, s) => calls.push({ h, s }));

    sys.tick(10, 10); // READY: chiama con h = -0.35
    sys.tryActivateLever(5, 5.5);
    for (let i = 0; i < TRAPS.lever.pullDurationTicks; i++) sys.tick(5, 5.5);

    // La prima chiamata (READY) deve avere handleAngle ≈ -0.35.
    expect(calls[0]!.h).toBeCloseTo(-0.35, 2);

    // Gli ultimi PULLING devono avere handleAngle crescente verso π/2.
    const pullingHandles = calls.slice(2); // salta READY + primo tick PULLING
    for (let i = 1; i < pullingHandles.length; i++) {
      expect(pullingHandles[i]!.h).toBeGreaterThanOrEqual(pullingHandles[i - 1]!.h);
    }

    // Alla fine di PULLING handleAngle deve essere ≈ π/2.
    expect(calls[calls.length - 1]!.h).toBeCloseTo(Math.PI / 2, 1);
  });

  it('durante PULLED sealY scende da sealDropM/2 a -sealDropM/2', () => {
    const sys = new TrapSystem([], makeLeverPassage());
    const sealYs: number[] = [];
    sys.registerLeverAnimator((_h, s) => sealYs.push(s));

    sys.tryActivateLever(5, 5.5);
    for (let i = 0; i < TRAPS.lever.pullDurationTicks; i++) sys.tick(5, 5.5);
    // Ora è PULLED. Raccoglie sealY per tutta la discesa.
    for (let i = 0; i < TRAPS.lever.sealDropTicks; i++) sys.tick(10, 10);

    const sealDrop = TRAPS.lever.sealDropM;
    // Primo tick PULLED: sealY deve essere vicino a sealDropM/2 (sigillo quasi chiuso).
    // (L'index corretto è dopo pullDurationTicks +1 animazioni)
    const pulledStart = sealYs[sealYs.length - TRAPS.lever.sealDropTicks]!;
    const pulledEnd = sealYs[sealYs.length - 1]!;

    expect(pulledStart).toBeGreaterThan(0);
    expect(pulledEnd).toBeCloseTo(-sealDrop / 2, 1);

    // Valori monotonicamente decrescenti durante la discesa.
    const pulledSlice = sealYs.slice(sealYs.length - TRAPS.lever.sealDropTicks);
    for (let i = 1; i < pulledSlice.length; i++) {
      expect(pulledSlice[i]!).toBeLessThanOrEqual(pulledSlice[i - 1]! + 1e-6);
    }
  });
});

// ---------------------------------------------------------------------------
// Interazione fra più trappole — danno cumulato
// ---------------------------------------------------------------------------

describe('TrapSystem – danno cumulato', () => {
  it('somma i danni di piastra e pendolo nello stesso tick', () => {
    // Piastra in (0,0) e pendolo in (2,0), giocatore in (0,0).
    // Al primo tick il giocatore attiva la piastra E può essere colpito dal
    // pendolo se la lama è nella zona.
    // Questo test verifica solo che il danno della piastra sia incluso;
    // il pendolo potrebbe non colpire al tick 1 (sin(0) = 0 → bladeOffset=0,
    // bladeZ=0 → distanza 2 m, fuori dal raggio 0.6 m).
    const sys = new TrapSystem(
      [makePressurePlate('pp'), makePendulum('bl')],
      null,
    );
    const dmg = sys.tick(0, 0); // giocatore in (0,0): attiva piastra
    expect(dmg).toBeGreaterThanOrEqual(TRAPS.pressurePlate.damageHp);
  });

  it('più piastre nello stesso piano: ognuna ha stato indipendente', () => {
    const traps: FloorSceneTrap[] = [
      { trapId: 'pp-a', kind: 'pressurePlate', position: { x: 0, y: 0, z: 0 } },
      { trapId: 'pp-b', kind: 'pressurePlate', position: { x: 5, y: 0, z: 0 } },
    ];
    const sys = new TrapSystem(traps, null);

    // Attiva solo pp-a (giocatore in 0,0).
    sys.tick(0, 0);

    const snapA = sys.getSnapshot().traps.find((t) => t.trapId === 'pp-a')!;
    const snapB = sys.getSnapshot().traps.find((t) => t.trapId === 'pp-b')!;
    expect(snapA.state).toBe('EXTEND');
    expect(snapB.state).toBe('ARMED'); // pp-b non tocca
  });
});

// ---------------------------------------------------------------------------
// getSnapshot — serializzabilità e consistenza
// ---------------------------------------------------------------------------

describe('TrapSystem – getSnapshot', () => {
  it('elapsedTicks corrisponde al numero di tick chiamati', () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    expect(sys.getSnapshot().elapsedTicks).toBe(0);

    sys.tick(10, 10);
    expect(sys.getSnapshot().elapsedTicks).toBe(1);

    for (let i = 0; i < 59; i++) sys.tick(10, 10);
    expect(sys.getSnapshot().elapsedTicks).toBe(60);
  });

  it('lo snapshot è un POJO: non contiene riferimenti a oggetti interni', () => {
    const sys = new TrapSystem([makePressurePlate()], makeLeverPassage());
    const snap = sys.getSnapshot();

    // Modificare lo snapshot non deve influenzare lo stato interno.
    const trap0 = snap.traps[0];
    if (trap0) (trap0 as { state: string }).state = 'COOLDOWN';
    snap.lever!.sealDropProgress = 0.99;

    sys.tick(0.1, 0); // attiva la piastra
    const snap2 = sys.getSnapshot();
    // Se lo snapshot fosse live reference, state sarebbe già COOLDOWN.
    expect(snap2.traps[0]!.state).toBe('EXTEND');
    expect(snap2.lever!.sealDropProgress).toBe(0);
  });

  it('traps restituisce array di copie, una per trappola', () => {
    const sys = new TrapSystem([makePressurePlate('pp-1'), makePendulum('bl-1')], null);
    const snap = sys.getSnapshot();
    expect(snap.traps).toHaveLength(2);
    const ids = snap.traps.map((t) => t.trapId).sort();
    expect(ids).toEqual(['bl-1', 'pp-1']);
  });

  it("lever è null quando non c'è lever passage", () => {
    const sys = new TrapSystem([makePressurePlate()], null);
    expect(sys.getSnapshot().lever).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Trappole su piani bassi — deriveTraps restituisce [] (test d'integrazione leggero)
// ---------------------------------------------------------------------------

describe('TrapSystem – comportamento con array di trappole vuoto', () => {
  it('tick non genera danno e non lancia errori con zero trappole', () => {
    const sys = new TrapSystem([], null);
    expect(() => sys.tick(0, 0)).not.toThrow();
    expect(sys.tick(0, 0)).toBe(0);
  });

  it('getSnapshot().traps è array vuoto', () => {
    const sys = new TrapSystem([], null);
    expect(sys.getSnapshot().traps).toHaveLength(0);
  });
});
