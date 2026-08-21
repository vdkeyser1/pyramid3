import { describe, expect, it } from 'vitest';
import {
  themeForRoom,
  presetFor,
  allowedThemesFor,
  ALL_THEMES,
  type RoomTheme,
} from '@/content/RoomThemes.js';
import type { RoomRole } from '@/procedural/FloorValidator.js';
import { MAX_FLOORS } from '@/content/floorProgression.js';

const ROLES: readonly RoomRole[] = [
  'ENTRY', 'EXIT', 'SAFE', 'COMBAT', 'TOOL',
  'MAP', 'TREASURE', 'FORGE', 'OPTIONAL', 'JUNCTION', 'STAIR',
];

describe('RoomThemes (ART-004)', () => {
  it('il tema è deterministico da piano e stanza', () => {
    // Stesso input ⇒ stesso tema: e la proprietà su cui poggia la
    // riproducibilità dell'intero piano dato un seed.
    for (const role of ROLES) {
      for (let f = 1; f <= MAX_FLOORS; f++) {
        const a = themeForRoom(f, 7, role);
        const b = themeForRoom(f, 7, role);
        expect(a).toBe(b);
      }
    }
  });

  it('rispetta sempre i temi ammessi per il ruolo', () => {
    // Il vincolo è di gameplay: un ingresso crollato o infestato renderebbe
    // il piano illeggibile o impraticabile fin dal primo passo.
    for (const role of ROLES) {
      const allowed = allowedThemesFor(role);
      for (let f = 1; f <= MAX_FLOORS; f++) {
        for (let room = 1; room <= 30; room++) {
          expect(allowed).toContain(themeForRoom(f, room, role));
        }
      }
    }
  });

  it('ingresso e stanze sicure restano sempre praticabili', () => {
    const risky: readonly RoomTheme[] = ['COLLAPSED', 'INFESTED', 'SAND_FILLED'];
    for (const role of ['ENTRY', 'SAFE'] as const) {
      for (let f = 1; f <= MAX_FLOORS; f++) {
        for (let room = 1; room <= 30; room++) {
          expect(risky).not.toContain(themeForRoom(f, room, role));
        }
      }
    }
  });

  it('stanze diverse dello stesso piano non hanno tutte lo stesso tema', () => {
    // Se l'hash collassasse, la varietà sarebbe solo teorica.
    const seen = new Set<RoomTheme>();
    for (let room = 1; room <= 30; room++) {
      seen.add(themeForRoom(5, room, 'COMBAT'));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('scendendo compaiono temi di abbandono', () => {
    // Il bias di profondità deve essere osservabile, non solo dichiarato.
    const countRuined = (floor: number): number => {
      let n = 0;
      for (let room = 1; room <= 40; room++) {
        const t = themeForRoom(floor, room, 'COMBAT');
        if (t === 'COLLAPSED' || t === 'SAND_FILLED' || t === 'INFESTED') n++;
      }
      return n;
    };
    // Confronto aggregato fra apice e base: il singolo piano può variare.
    expect(countRuined(MAX_FLOORS)).toBeGreaterThan(countRuined(1));
  });

  it('ogni tema ha un preset completo e coerente', () => {
    for (const theme of ALL_THEMES) {
      const p = presetFor(theme);
      expect(p.theme).toBe(theme);
      expect(p.label.length).toBeGreaterThan(0);
      // La luce è un moltiplicatore relativo, mai un valore assoluto:
      // fuori da questa banda schiaccerebbe il preset base.
      expect(p.lightScale).toBeGreaterThan(0.4);
      expect(p.lightScale).toBeLessThan(2);
    }
  });

  it('le stanze crollate e insabbiate non hanno colonnate', () => {
    // È l'assenza di ordine architettonico a caratterizzarle.
    expect(presetFor('COLLAPSED').columns).toBe(false);
    expect(presetFor('SAND_FILLED').columns).toBe(false);
    expect(presetFor('ROYAL').columns).toBe(true);
  });

  it('solo i temi nobili e funerari hanno il cielo dipinto', () => {
    expect(presetFor('ROYAL').ceiling).toBe('STARRY');
    expect(presetFor('FUNERARY').ceiling).toBe('STARRY');
    expect(presetFor('COLLAPSED').ceiling).toBe('COLLAPSED');
    expect(presetFor('INFESTED').ceiling).toBe('FLAT_STONE');
  });
});
