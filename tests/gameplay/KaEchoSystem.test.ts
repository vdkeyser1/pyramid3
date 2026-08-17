import { describe, expect, it } from 'vitest';
import {
  createKaEchoState,
  tickKaEcho,
  isKaEchoActive,
  canActivateKaEcho,
  activateKaEcho,
} from '@/gameplay/echo/KaEchoSystem.js';
import { TORCH, NOISE_MULTIPLIER } from '@/content/balance.js';

describe('KaEchoSystem', () => {
  it('stato iniziale inattivo', () => {
    const state = createKaEchoState();
    expect(isKaEchoActive(state)).toBe(false);
    expect(state.cooldownTicks).toBe(0);
  });

  it('attivazione riuscita setta parametri corretti', () => {
    const state = createKaEchoState();
    const result = activateKaEcho(state, true, 180);
    expect(result.activated).toBe(true);
    expect(result.fuelCost).toBe(TORCH.kaEchoCostSeconds);
    expect(result.noiseIntensity).toBe(NOISE_MULTIPLIER.kaEcho);
    expect(result.durationTicks).toBe(TORCH.kaEchoDurationTicks);
    expect(isKaEchoActive(state)).toBe(true);
    expect(state.cooldownTicks).toBe(TORCH.kaEchoCooldownTicks);
  });

  it('rifiutata in cooldown', () => {
    const state = createKaEchoState();
    activateKaEcho(state, true, 180);
    const result = activateKaEcho(state, true, 180);
    expect(result.activated).toBe(false);
  });

  it('rifiutata con combustibile insufficiente', () => {
    const state = createKaEchoState();
    const result = activateKaEcho(state, true, 2);
    expect(result.activated).toBe(false);
  });

  it('rifiutata con torcia spenta e fuel 0', () => {
    const state = createKaEchoState();
    const result = activateKaEcho(state, false, 0);
    expect(result.activated).toBe(false);
  });

  it('tick decrementa active e cooldown', () => {
    const state = createKaEchoState();
    activateKaEcho(state, true, 180);
    const prevActive = state.activeTicks;
    const prevCooldown = state.cooldownTicks;
    tickKaEcho(state);
    expect(state.activeTicks).toBe(prevActive - 1);
    expect(state.cooldownTicks).toBe(prevCooldown - 1);
  });

  it('canActivateKaEcho restituisce false in cooldown', () => {
    const state = createKaEchoState();
    state.cooldownTicks = 10;
    expect(canActivateKaEcho(state, true, 180)).toBe(false);
  });

  it('canActivateKaEcho restituisce true quando disponibile', () => {
    const state = createKaEchoState();
    expect(canActivateKaEcho(state, true, 180)).toBe(true);
  });
});
