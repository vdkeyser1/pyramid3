import { describe, it, expect, vi } from 'vitest';
import { SystemScheduler } from '@/simulation/SystemScheduler.js';

describe('SystemScheduler', () => {
  it('esegue il sistema ogni tick con everyNTicks=1', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    scheduler.register('sys', fn, 1);
    scheduler.step();
    scheduler.step();
    scheduler.step();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('esegue ogni 3 tick con everyNTicks=3', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    scheduler.register('sys', fn, 3);
    // tick 0: (0 - 0) % 3 === 0 → eseguito
    // tick 1: 1 % 3 !== 0 → no
    // tick 2: 2 % 3 !== 0 → no
    // tick 3: 3 % 3 === 0 → eseguito
    scheduler.stepN(4);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 0);
    expect(fn).toHaveBeenNthCalledWith(2, 3);
  });

  it('phaseOffset distribuisce i tick correttamente', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    // everyNTicks=3, phaseOffset=1 → esegue a tick 1, 4, 7 ...
    scheduler.register('sys', fn, 3, 1);
    scheduler.stepN(8); // ticks 0..7
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 4);
    expect(fn).toHaveBeenNthCalledWith(3, 7);
  });

  it('sistema disabilitato non viene chiamato', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    scheduler.register('sys', fn);
    scheduler.setEnabled('sys', false);
    scheduler.stepN(5);
    expect(fn).not.toHaveBeenCalled();
  });

  it('re-abilitazione funziona correttamente', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    scheduler.register('sys', fn);
    scheduler.setEnabled('sys', false);
    scheduler.step(); // no call
    scheduler.setEnabled('sys', true);
    scheduler.step(); // call
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('unregister rimuove il sistema', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    scheduler.register('sys', fn);
    scheduler.unregister('sys');
    scheduler.step();
    expect(fn).not.toHaveBeenCalled();
  });

  it('registrare lo stesso id due volte lancia errore', () => {
    const scheduler = new SystemScheduler();
    scheduler.register('sys', vi.fn());
    expect(() => scheduler.register('sys', vi.fn())).toThrow();
  });

  it('reset azzera tick e rimuove tutti i sistemi', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    scheduler.register('sys', fn);
    scheduler.stepN(5);
    scheduler.reset();
    fn.mockClear();
    expect(scheduler.tick).toBe(0);
    expect(scheduler.list()).toHaveLength(0);
    scheduler.step();
    expect(fn).not.toHaveBeenCalled();
  });

  it('tick viene incrementato correttamente', () => {
    const scheduler = new SystemScheduler();
    expect(scheduler.tick).toBe(0);
    scheduler.step();
    expect(scheduler.tick).toBe(1);
    scheduler.stepN(9);
    expect(scheduler.tick).toBe(10);
  });

  it('sistemi multipli con frequenze diverse', () => {
    const scheduler = new SystemScheduler();
    const fn1 = vi.fn();  // ogni tick
    const fn2 = vi.fn();  // ogni 2 tick
    const fn4 = vi.fn();  // ogni 4 tick
    scheduler.register('s1', fn1, 1);
    scheduler.register('s2', fn2, 2);
    scheduler.register('s4', fn4, 4);
    scheduler.stepN(8); // tick 0..7
    expect(fn1).toHaveBeenCalledTimes(8);
    expect(fn2).toHaveBeenCalledTimes(4);
    expect(fn4).toHaveBeenCalledTimes(2);
  });

  it('everyNTicks < 1 viene normalizzato a 1', () => {
    const scheduler = new SystemScheduler();
    const fn = vi.fn();
    scheduler.register('sys', fn, 0); // normalizza a 1
    scheduler.stepN(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
