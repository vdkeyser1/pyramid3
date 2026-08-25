import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEATURE_FLAGS,
  nonDefaultFlags,
  resolveFeatureFlags,
} from '@/config/FeatureFlags.js';

describe('FeatureFlags', () => {
  it('restituisce i default senza override', () => {
    expect(resolveFeatureFlags()).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('applica override noti e ignora chiavi sconosciute', () => {
    const flags = resolveFeatureFlags({
      kaEcho: true,
      meshLod: false,
      unknownFlag: true,
    });
    expect(flags.kaEcho).toBe(true);
    expect(flags.meshLod).toBe(false);
    expect(flags.shadowMapOpt).toBe(true);
  });

  it('nonDefaultFlags elenca solo i delta', () => {
    const flags = resolveFeatureFlags({ sounding: true });
    expect(nonDefaultFlags(flags)).toEqual({ sounding: true });
  });
});
