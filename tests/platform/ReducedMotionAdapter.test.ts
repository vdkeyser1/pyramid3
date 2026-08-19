import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReducedMotionAdapter,
  getReducedMotionAdapter,
  disposeReducedMotionAdapter,
} from '@/platform/ReducedMotionAdapter.js';

// ── Mock matchMedia ───────────────────────────────────────────────────────────

type MQLListener = (e: MediaQueryListEvent) => void;

function makeMockMQL(matches: boolean) {
  let _matches = matches;
  const listeners = new Set<MQLListener>();

  const mql = {
    get matches() { return _matches; },
    addEventListener(_: string, fn: MQLListener) { listeners.add(fn); },
    removeEventListener(_: string, fn: MQLListener) { listeners.delete(fn); },
    // Simula cambio della preferenza
    _trigger(newMatches: boolean) {
      _matches = newMatches;
      for (const l of listeners) {
        l({ matches: newMatches } as MediaQueryListEvent);
      }
    },
  };
  return mql;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReducedMotionAdapter', () => {
  let mockMQL: ReturnType<typeof makeMockMQL>;

  beforeEach(() => {
    disposeReducedMotionAdapter(); // reset singleton
    mockMQL = makeMockMQL(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mockMQL as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    disposeReducedMotionAdapter();
    vi.restoreAllMocks();
  });

  it('isReduced restituisce false se non impostato', () => {
    const adapter = new ReducedMotionAdapter();
    expect(adapter.isReduced).toBe(false);
    adapter.dispose();
  });

  it('isReduced restituisce true se matchMedia matches', () => {
    mockMQL = makeMockMQL(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mockMQL as unknown as MediaQueryList,
    );
    const adapter = new ReducedMotionAdapter();
    expect(adapter.isReduced).toBe(true);
    adapter.dispose();
  });

  it('onChange notifica il listener al cambio', () => {
    const adapter  = new ReducedMotionAdapter();
    const listener = vi.fn();
    adapter.onChange(listener);

    mockMQL._trigger(true);
    expect(listener).toHaveBeenCalledWith(true);

    mockMQL._trigger(false);
    expect(listener).toHaveBeenCalledWith(false);
    expect(listener).toHaveBeenCalledTimes(2);

    adapter.dispose();
  });

  it('cleanup da onChange rimuove il listener', () => {
    const adapter  = new ReducedMotionAdapter();
    const listener = vi.fn();
    const off      = adapter.onChange(listener);

    mockMQL._trigger(true);
    expect(listener).toHaveBeenCalledTimes(1);

    off(); // rimuove
    mockMQL._trigger(false);
    expect(listener).toHaveBeenCalledTimes(1); // non chiamato di nuovo

    adapter.dispose();
  });

  it('dispose rimuove tutti i listener e non notifica più', () => {
    const adapter  = new ReducedMotionAdapter();
    const listener = vi.fn();
    adapter.onChange(listener);
    adapter.dispose();

    mockMQL._trigger(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('getReducedMotionAdapter ritorna sempre lo stesso singleton', () => {
    const a = getReducedMotionAdapter();
    const b = getReducedMotionAdapter();
    expect(a).toBe(b);
  });

  it('disposeReducedMotionAdapter crea nuovo singleton al prossimo accesso', () => {
    const a = getReducedMotionAdapter();
    disposeReducedMotionAdapter();
    const b = getReducedMotionAdapter();
    expect(a).not.toBe(b);
  });
});
