import { describe, expect, it } from 'vitest';
import { getProceduralCueProfile } from '@/audio/ProceduralCueLibrary.js';

describe('ProceduralCueLibrary (G-18)', () => {
  it('espone i cue di combattimento con profili validi', () => {
    for (const name of ['attack_swing', 'attack_hit', 'player_dodge', 'gold_pickup']) {
      const profile = getProceduralCueProfile(name);
      expect(profile.durationSeconds).toBeGreaterThan(0);
      expect(profile.gain).toBeGreaterThan(0);
      expect(profile.frequencyHz).toBeGreaterThan(0);
    }
  });

  it('i cue di combattimento hanno frequenze distinte e riconoscibili', () => {
    const swing = getProceduralCueProfile('attack_swing');
    const hit = getProceduralCueProfile('attack_hit');
    const dodge = getProceduralCueProfile('player_dodge');
    const gold = getProceduralCueProfile('gold_pickup');

    // Ogni firma sonora deve essere distinguibile
    expect(hit.frequencyHz).toBeLessThan(swing.frequencyHz);
    expect(dodge.endFrequencyHz ?? dodge.frequencyHz).toBeGreaterThan(swing.frequencyHz);
    expect(gold.frequencyHz).toBeGreaterThan(hit.frequencyHz);
  });

  it('fallback default per nomi sconosciuti', () => {
    const unknown = getProceduralCueProfile('non-esiste');
    expect(unknown.waveform).toBe('sine');
    expect(unknown.frequencyHz).toBe(220);
  });
});

// B-04 ext: cue nemici aggiuntivi
describe('ProceduralCueLibrary — cue nemici (B-04 ext)', () => {
  const ENEMY_CUES = [
    'scarab_click', 'snake_hiss', 'mummy_creak', 'mummy_grab',
    'shabti_swing', 'shabti_charge', 'sobek_bite', 'sobek_tail',
    'royal_swing', 'royal_curse', 'priest_dart', 'stone_scrape',
  ] as const;

  it('tutti i cue nemici hanno profili validi (gain>0, duration>0, freq>0)', () => {
    for (const name of ENEMY_CUES) {
      const p = getProceduralCueProfile(name);
      expect(p.gain, name).toBeGreaterThan(0);
      expect(p.durationSeconds, name).toBeGreaterThan(0);
      expect(p.frequencyHz, name).toBeGreaterThan(0);
    }
  });

  it('i cue a rumore hanno noiseLowpassHz definito e positivo', () => {
    const noiseCues = ['snake_hiss', 'mummy_creak', 'mummy_grab',
      'shabti_swing', 'shabti_charge', 'sobek_bite', 'sobek_tail',
      'royal_swing', 'stone_scrape'] as const;
    for (const name of noiseCues) {
      const p = getProceduralCueProfile(name);
      expect(p.noise, name).toBe(true);
      expect(p.noiseLowpassHz ?? 0, name).toBeGreaterThan(0);
    }
  });

  it('scarab_click è il più breve (scatto) e snake_hiss il più lungo', () => {
    const click = getProceduralCueProfile('scarab_click');
    const hiss = getProceduralCueProfile('snake_hiss');
    expect(click.durationSeconds).toBeLessThan(0.1);
    expect(hiss.durationSeconds).toBeGreaterThan(0.4);
  });

  it('royal_swing ha gain massimo tra i cue di attacco (boss)', () => {
    const royal = getProceduralCueProfile('royal_swing');
    const scarab = getProceduralCueProfile('scarab_click');
    expect(royal.gain).toBeGreaterThan(scarab.gain);
  });

  it('royal_curse: tono puro etereo (no noise), frequenza discendente, onset lento', () => {
    const curse = getProceduralCueProfile('royal_curse');
    // Deve essere riconoscibile come soprannaturale: sine puro, nessun rumore.
    expect(curse.waveform).toBe('sine');
    expect(curse.noise ?? false).toBe(false);
    // La frequenza scende (maledizione che cala sulla vittima).
    const endHz = curse.endFrequencyHz ?? curse.frequencyHz;
    expect(endHz).toBeLessThan(curse.frequencyHz);
    // La carica dura almeno 0.5 s — coerente con anticip. 1.4 s in enemies.ts.
    expect(curse.durationSeconds).toBeGreaterThan(0.5);
    // Onset deliberatamente lento per enfatizzare il telegrafo.
    expect(curse.attackSeconds).toBeGreaterThan(0.04);
    // Fisicamente distinto dal fendente (che ha noise=true, sawtooth).
    const swing = getProceduralCueProfile('royal_swing');
    expect(curse.waveform).not.toBe(swing.waveform);
    expect(curse.noise ?? false).not.toBe(swing.noise ?? false);
  });
});

describe('ProceduralCueLibrary — cue trappole e manufatti egizi (P04)', () => {
  const PYRAMID_CUES = [
    'trap_blade_whoosh',
    'trap_spikes_extend',
    'trap_boulder_rumble',
    'trap_lever_pull',
    'relic_chime',
    'sand_pour',
  ] as const;

  it('tutti i cue delle trappole hanno parametri validi', () => {
    for (const name of PYRAMID_CUES) {
      const p = getProceduralCueProfile(name);
      expect(p.gain, name).toBeGreaterThan(0);
      expect(p.durationSeconds, name).toBeGreaterThan(0);
      expect(p.frequencyHz, name).toBeGreaterThan(0);
    }
  });

  it('relic_chime è una risonanza eterea pura ad alta frequenza', () => {
    const relic = getProceduralCueProfile('relic_chime');
    expect(relic.waveform).toBe('sine');
    expect(relic.frequencyHz).toBeGreaterThan(700);
    expect(relic.durationSeconds).toBeGreaterThan(1.0);
  });

  it('trap_boulder_rumble è il più profondo e lungo tra i rumori di trappola', () => {
    const rumble = getProceduralCueProfile('trap_boulder_rumble');
    const spikes = getProceduralCueProfile('trap_spikes_extend');
    expect(rumble.frequencyHz).toBeLessThan(spikes.frequencyHz);
    expect(rumble.durationSeconds).toBeGreaterThan(spikes.durationSeconds);
  });
});
