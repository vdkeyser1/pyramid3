import { describe, expect, it } from 'vitest';
import {
  deriveTorchPresentation,
  resolveTorchAction,
} from '@/app/TorchActions.js';
import { TORCH } from '@/content/balance.js';
import { createTorch, type TorchRuntime } from '@/gameplay/torch/TorchSystem.js';

describe('TorchActions', () => {
  it('TOGGLE accende la torcia e produce messaggio coerente', () => {
    const resolved = resolveTorchAction(createTorch(), 'TOGGLE');

    expect(resolved.result.changed).toBe(true);
    expect(resolved.result.runtime.state).toBe('HIGH');
    expect(resolved.message).toBe('Torcia accesa.');
  });

  it('PLACE_OR_PICK_UP posa e raccoglie la torcia', () => {
    const litTorch: TorchRuntime = { ...createTorch(), state: 'HIGH' };

    const placed = resolveTorchAction(litTorch, 'PLACE_OR_PICK_UP');
    expect(placed.result.runtime.state).toBe('PLACED');
    expect(placed.message).toBe('Torcia posata.');

    const picked = resolveTorchAction(placed.result.runtime, 'PLACE_OR_PICK_UP');
    expect(picked.result.runtime.state).toBe('HIGH');
    expect(picked.message).toBe('Torcia raccolta.');
  });

  it('WAVE rifiuta la torcia posata con un feedback esplicito', () => {
    const placedTorch: TorchRuntime = { ...createTorch(), state: 'PLACED' };

    const resolved = resolveTorchAction(placedTorch, 'WAVE');

    expect(resolved.result.changed).toBe(false);
    expect(resolved.message).toBe('Raccogli la torcia per agitarla.');
  });

  it('KA_ECHO riporta il cooldown residuo quando non e disponibile', () => {
    const cooldownTorch: TorchRuntime = {
      ...createTorch(),
      state: 'HIGH',
      kaEchoCooldownTicks: TORCH.kaEchoCooldownTicks,
    };

    const resolved = resolveTorchAction(cooldownTorch, 'KA_ECHO');

    expect(resolved.result.changed).toBe(false);
    expect(resolved.message).toContain("L'Eco del Ka non risponde ancora.");
    expect(resolved.message).toContain('12 s');
  });

  it('deriveTorchPresentation mantiene la luce fallback quando la torcia e posata', () => {
    const presentation = deriveTorchPresentation({ ...createTorch(), state: 'PLACED' });

    expect(presentation.hudTorchLit).toBe(true);
    expect(presentation.torchPlaced).toBe(true);
    expect(presentation.handLightOn).toBe(false);
  });
});
