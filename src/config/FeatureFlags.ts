/**
 * Scopo: feature flag per rollout graduale delle meccaniche v4.
 * Ownership: configurazione. Letto da gameplay, mai scritto a runtime.
 * Invarianti:
 *   - ogni flag ha un default conservativo (disabilitato);
 *   - i flag sono leggibili dal Papiro della Run per diagnostica;
 *   - nessun flag modifica accessibilità o controlli.
 * Failure mode: un flag sconosciuto viene ignorato con warning.
 *
 * ADR-009: kaEcho e sounding dietro flag per misurare il loop con e senza.
 * ADR-010: brazierInvestment dietro flag; fallback = braciere decorativo.
 */

export interface FeatureFlags {
  /** Richiamo del Ka — impulso di orientamento (MIG-02, ADR-009). */
  readonly kaEcho: boolean;
  /** Sondaggio del terreno — ricerca attiva del tesoro (MIG-03, ADR-009). */
  readonly sounding: boolean;
  /** Bracieri come investimento territoriale (MIG-01, ADR-010). */
  readonly brazierInvestment: boolean;
  /** Finestra di punizione segnalata visivamente (MIG-04). */
  readonly punishWindowSignal: boolean;
  /** Protezioni anti-frustrazione del director (MIG-05). */
  readonly directorAntifrustration: boolean;
}

type MutableFeatureFlags = {
  -readonly [K in keyof FeatureFlags]: FeatureFlags[K];
};

export const DEFAULT_FEATURE_FLAGS: Readonly<FeatureFlags> = {
  kaEcho: false,
  sounding: false,
  brazierInvestment: false,
  punishWindowSignal: true,
  directorAntifrustration: true,
} as const;

/**
 * Restituisce i flag attivi, sovrascrivendo i default con eventuali override.
 * I flag non riconosciuti vengono ignorati con warning in console.
 */
export function resolveFeatureFlags(
  overrides?: Partial<Record<string, boolean>>,
): FeatureFlags {
  if (!overrides) return { ...DEFAULT_FEATURE_FLAGS };

  const resolved: MutableFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
  const knownKeys = new Set<string>(Object.keys(DEFAULT_FEATURE_FLAGS));

  for (const [key, value] of Object.entries(overrides)) {
    if (!knownKeys.has(key)) {
      console.warn(`[FeatureFlags] flag sconosciuto ignorato: "${key}"`);
      continue;
    }
    if (typeof value === 'boolean') {
      (resolved as Record<string, boolean>)[key] = value;
    }
  }

  return resolved;
}

/**
 * Restituisce solo i flag che differiscono dal default, per il Papiro (MIG-12).
 */
export function nonDefaultFlags(flags: FeatureFlags): Partial<FeatureFlags> {
  const diff: Partial<MutableFeatureFlags> = {};
  const keys = Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[];
  for (const key of keys) {
    if (flags[key] !== DEFAULT_FEATURE_FLAGS[key]) {
      diff[key] = flags[key];
    }
  }
  return diff;
}
