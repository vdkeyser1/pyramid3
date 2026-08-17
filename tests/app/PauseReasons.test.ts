import { describe, expect, it } from 'vitest';
import { createPauseReasonTracker } from '@/app/PauseReasons.js';

describe('createPauseReasonTracker', () => {
  it('does not resume while another pause reason is still active', () => {
    const tracker = createPauseReasonTracker();

    expect(tracker.add('manual')).toBe(true);
    expect(tracker.add('visibility')).toBe(true);
    expect(tracker.paused).toBe(true);

    expect(tracker.remove('visibility')).toBe(true);
    expect(tracker.paused).toBe(true);
    expect(tracker.has('manual')).toBe(true);

    expect(tracker.remove('manual')).toBe(true);
    expect(tracker.paused).toBe(false);
  });

  it('ignores duplicate reasons', () => {
    const tracker = createPauseReasonTracker();

    expect(tracker.add('manual')).toBe(true);
    expect(tracker.add('manual')).toBe(false);
    expect(tracker.activeReasons).toEqual(['manual']);
  });
});
