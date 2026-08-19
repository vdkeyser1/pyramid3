import { describe, it, expect } from 'vitest';
import { EnemyEncounterPool } from '@/simulation/EnemyEncounterPool.js';

describe('EnemyEncounterPool', () => {
  it('acquire restituisce oggetto inizializzato con i default', () => {
    const pool  = new EnemyEncounterPool(4);
    const state = pool.acquire();
    expect(state.stateTag).toBe('IDLE');
    expect(state.hp).toBe(0);
    expect(state.alertRadius).toBe(6);
  });

  it('acquire applica override correttamente', () => {
    const pool  = new EnemyEncounterPool(4);
    const state = pool.acquire({ enemyType: 'GUARD', hp: 50, maxHp: 50 });
    expect(state.enemyType).toBe('GUARD');
    expect(state.hp).toBe(50);
  });

  it('release riduce activeCount e aumenta freeCount', () => {
    const pool = new EnemyEncounterPool(4);
    const s    = pool.acquire();
    expect(pool.activeCount).toBe(1);
    pool.release(s);
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBeGreaterThanOrEqual(4); // ritornato nel pool
  });

  it('release resetta lo stato prima di reinserirlo', () => {
    const pool  = new EnemyEncounterPool(4);
    const state = pool.acquire({ enemyType: 'MUMMY', hp: 100, maxHp: 100 });
    pool.release(state);
    // Ora acquisiamo di nuovo — deve essere pulito
    const state2 = pool.acquire();
    expect(state2.enemyType).toBe('');
    expect(state2.hp).toBe(0);
  });

  it('doppio release è sicuro (noop sul secondo)', () => {
    const pool  = new EnemyEncounterPool(4);
    const state = pool.acquire();
    pool.release(state);
    expect(() => pool.release(state)).not.toThrow();
    expect(pool.activeCount).toBe(0);
  });

  it('releaseAll svuota tutti gli attivi', () => {
    const pool = new EnemyEncounterPool(4);
    pool.acquire();
    pool.acquire();
    pool.acquire();
    expect(pool.activeCount).toBe(3);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
  });

  it('oltre maxSize gli oggetti vengono abbandonati (non si accumulano)', () => {
    const pool = new EnemyEncounterPool(2, 2); // max 2 nel free
    const states = Array.from({ length: 5 }, () => pool.acquire());
    states.forEach((s) => pool.release(s));
    // Il pool ha massimo 2 free slot
    expect(pool.freeCount).toBe(2);
  });

  it('crea nuovi oggetti se il pool è vuoto', () => {
    const pool = new EnemyEncounterPool(0); // nessuna pre-alloc
    const s    = pool.acquire();
    expect(s).toBeDefined();
    expect(pool.activeCount).toBe(1);
  });
});
