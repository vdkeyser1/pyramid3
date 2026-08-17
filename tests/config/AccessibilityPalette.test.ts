import {
  resolveUiAccessibilityPalette,
  resolveWorldAccessibilityPalette,
} from '@/config/AccessibilityPalette.js';
import { describe, expect, it } from 'vitest';

describe('AccessibilityPalette', () => {
  it('mantiene la palette storica in modalita none', () => {
    const ui = resolveUiAccessibilityPalette('none', false);
    const world = resolveWorldAccessibilityPalette('none', false);

    expect(ui.textColor).toBe('#D4A05A');
    expect(ui.accentColor).toBe('#2E8B8B');
    expect(world.backgroundColor).toBe(0x0b0908);
    expect(world.exitColor).toBe(0x5a3f1b);
  });

  it('restituisce palette visibilmente distinta per tritanopia', () => {
    const ui = resolveUiAccessibilityPalette('tritanopia', false);
    const world = resolveWorldAccessibilityPalette('tritanopia', false);

    expect(ui.textColor).toBe('#E7C0C8');
    expect(ui.borderColor).toBe('#875164');
    expect(world.backgroundColor).toBe(0x11090b);
    expect(world.exitColor).toBe(0xb97b75);
  });
});
