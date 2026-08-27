/**
 * Scopo: libreria asset audio reali (Kenney CC0) per i cue del gioco.
 *        Mappa nome cue → lista di path (varianti): il runtime ne sceglie una
 *        casuale per varietà. Se un cue non ha asset, il motore usa il profilo
 *        procedurale (fallback silenzioso).
 * Ownership: audio. Pura: nessuna dipendenza da AudioContext/DOM.
 * Invarianti:
 *   - ogni variante punta a un file .ogg o .wav sotto /audio (public/);
 *   - almeno una variante per cue mappato;
 *   - il runtime NON fallisce se un file manca: il cue torna al procedurale.
 * Failure mode: asset assente ⇒ il cue suona con il profilo sintetico.
 */

/** Mappa cue → varianti audio reali (Kenney CC0, attribuzione in CREDITS). */
export const AUDIO_ASSET_MAP: Readonly<Record<string, readonly string[]>> = {
  footstep_sand: [
    'audio/sfx_footstep_000.ogg',
    'audio/sfx_footstep_001.ogg',
    'audio/sfx_footstep_002.ogg',
    'audio/sfx_footstep_003.ogg',
    // B-04: varianti RPG Audio (passi su pietra/sabbia più corposi).
    'audio/real_footstep_0.ogg',
    'audio/real_footstep_1.ogg',
    'audio/real_footstep_2.ogg',
    'audio/real_footstep_3.ogg',
    'audio/real_footstep_4.ogg',
  ],
  attack_hit: [
    'audio/sfx_hit_000.ogg',
    'audio/sfx_hit_001.ogg',
    'audio/sfx_hit_002.ogg',
  ],
  crit_hit: [
    'audio/sfx_crit_000.ogg',
    'audio/sfx_crit_001.ogg',
    'audio/sfx_crit_002.ogg',
  ],
  parry_success: [
    'audio/sfx_parry_000.ogg',
    'audio/sfx_parry_001.ogg',
    'audio/sfx_parry_002.ogg',
  ],
  ui_click: [
    'audio/sfx_click_000.ogg',
    'audio/sfx_click_001.ogg',
  ],
  treasure_found: [
    'audio/sfx_confirmation_000.ogg',
    'audio/sfx_confirmation_001.ogg',
  ],
  // B-04: foley Kenney RPG Audio (pack aggiuntivo CC0).
  door_creak: [
    'audio/real_door_creak_1.ogg',
    'audio/real_door_creak_2.ogg',
    'audio/real_door_creak_3.ogg',
  ],
  gold_pickup: [
    'audio/real_gold_1.ogg',
    'audio/real_gold_2.ogg',
  ],
  attack_swing: [
    'audio/real_swing_1.ogg',
    'audio/real_swing_2.ogg',
    'audio/real_swing_3.ogg',
  ],
  // W-3: audio atmosferico egizio (CC0 — da scaricare e piazzare in public/audio/).
  // Se i file mancano il motore usa il fallback procedurale (silenzio pesante).
  // Sorgenti consigliate: Freesound.org CC0, OpenGameArt CC0.
  stone_door: [
    'audio/effects/stone_door_open.ogg',
    // G-26: riuso Kenney se il foley dedicato manca.
    'audio/real_door_creak_1.ogg',
    'audio/real_door_creak_2.ogg',
    'audio/real_door_creak_3.ogg',
  ],
  trap_trigger: [
    'audio/effects/trap_trigger.ogg',
    'audio/sfx_hit_000.ogg',
    'audio/sfx_hit_001.ogg',
    'audio/sfx_hit_002.ogg',
  ],
  torch_ignite: [
    'audio/effects/torch_ignite.ogg',
    'audio/sfx_confirmation_000.ogg',
    'audio/sfx_confirmation_001.ogg',
  ],
  // G-26: loop ambientali (WAV/OGG — fallback sintetico se assenti).
  desert_wind: [
    'audio/ambience/desert_wind.ogg',
    'audio/ambience/desert_wind.wav',
  ],
  tomb_drip: [
    'audio/ambience/tomb_drip.ogg',
    'audio/ambience/tomb_drip.wav',
  ],
  sacred_hum: [
    'audio/ambience/sacred_hum.ogg',
    'audio/ambience/sacred_hum.wav',
    'audio/ambience/tomb_drip.wav',
  ],
  infested_chitter: [
    'audio/ambience/infested_chitter.ogg',
    'audio/ambience/infested_chitter.wav',
    'audio/ambience/tomb_drip.wav',
  ],
};

/** Invarianti della mappa (usata dai test). */
export function validateAudioAssetMap(): boolean {
  for (const [cue, variants] of Object.entries(AUDIO_ASSET_MAP)) {
    if (cue.length === 0 || variants.length === 0) return false;
    for (const path of variants) {
      if (!path.endsWith('.ogg') && !path.endsWith('.wav')) return false;
      if (!path.startsWith('audio/')) return false;
    }
  }
  return true;
}
