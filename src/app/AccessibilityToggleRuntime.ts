/**
 * Scopo: gestire i toggle di accessibilità che cambiano la semantica
 * dell'input a runtime senza toccare la ActionMap.
 * Ownership: GameApplication conserva questo stato e lo consulta nel polling.
 */

export interface AccessibilityToggleRuntime {
  sprintLatched: boolean;
}

export function createAccessibilityToggleRuntime(): AccessibilityToggleRuntime {
  return {
    sprintLatched: false,
  };
}

export function syncSprintToggleSetting(
  runtime: AccessibilityToggleRuntime,
  enabled: boolean,
): void {
  if (!enabled) {
    runtime.sprintLatched = false;
  }
}

export function toggleSprintLatch(
  runtime: AccessibilityToggleRuntime,
  enabled: boolean,
): boolean {
  if (!enabled) {
    return false;
  }

  runtime.sprintLatched = !runtime.sprintLatched;
  return runtime.sprintLatched;
}

export function isSprintActive(
  runtime: AccessibilityToggleRuntime,
  enabled: boolean,
  held: boolean,
): boolean {
  return enabled ? runtime.sprintLatched : held;
}
