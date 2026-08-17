import {
  createAccessibilityToggleRuntime,
  isSprintActive,
  syncSprintToggleSetting,
  toggleSprintLatch,
} from '@/app/AccessibilityToggleRuntime.js';
import { describe, expect, it } from 'vitest';

describe('AccessibilityToggleRuntime', () => {
  it('usa il tasto held quando sprint toggle e disattivato', () => {
    const runtime = createAccessibilityToggleRuntime();

    expect(isSprintActive(runtime, false, false)).toBe(false);
    expect(isSprintActive(runtime, false, true)).toBe(true);
  });

  it('aggancia e sgancia lo sprint quando il toggle e attivo', () => {
    const runtime = createAccessibilityToggleRuntime();

    expect(toggleSprintLatch(runtime, true)).toBe(true);
    expect(isSprintActive(runtime, true, false)).toBe(true);

    expect(toggleSprintLatch(runtime, true)).toBe(false);
    expect(isSprintActive(runtime, true, true)).toBe(false);
  });

  it('resetta il latch quando il setting viene disattivato', () => {
    const runtime = createAccessibilityToggleRuntime();

    toggleSprintLatch(runtime, true);
    expect(runtime.sprintLatched).toBe(true);

    syncSprintToggleSetting(runtime, false);
    expect(runtime.sprintLatched).toBe(false);
    expect(isSprintActive(runtime, false, true)).toBe(true);
  });
});
