export type PauseReason = 'manual' | 'visibility' | 'death' | 'menu';

export interface PauseReasonTracker {
  readonly paused: boolean;
  readonly activeReasons: readonly PauseReason[];
  has(reason: PauseReason): boolean;
  add(reason: PauseReason): boolean;
  remove(reason: PauseReason): boolean;
  clear(): void;
}

export function createPauseReasonTracker(): PauseReasonTracker {
  const activeReasons = new Set<PauseReason>();

  return {
    get paused(): boolean {
      return activeReasons.size > 0;
    },

    get activeReasons(): readonly PauseReason[] {
      return [...activeReasons];
    },

    has(reason: PauseReason): boolean {
      return activeReasons.has(reason);
    },

    add(reason: PauseReason): boolean {
      const hadReason = activeReasons.has(reason);
      activeReasons.add(reason);
      return !hadReason;
    },

    remove(reason: PauseReason): boolean {
      return activeReasons.delete(reason);
    },

    clear(): void {
      activeReasons.clear();
    },
  };
}
