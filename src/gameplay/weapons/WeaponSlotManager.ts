/**
 * G-06 — Secondo slot arma con quick-switch.
 *
 * Scopo: gestisce due slot arma (PRIMARY e SECONDARY) e il cambio rapido
 *        tra di essi. Tracccia il cooldown di switch e la slot attiva.
 * Ownership: istanza per sessione di gioco, vive nel GameState del giocatore.
 *            No dipendenze di rendering — lo stato è esposto via snapshot.
 *
 * Invarianti:
 *   - solo uno slot è "attivo" alla volta;
 *   - swapWeapons() è un noop se il cooldown di switch non è esaurito;
 *   - uno slot può essere vuoto (null);
 *   - il tick è incrementato solo da step(), mai dall'esterno.
 */

import {
  type WeaponDefinition,
  type WeaponRuntime,
  createWeaponRuntime,
  consumeDurability,
  isWeaponBroken,
  getDurabilityRatio,
} from './WeaponDefinition.js';
import { COMBAT } from '../../content/balance.js';

// ── Tipi ─────────────────────────────────────────────────────────────────────

/** I due slot arma disponibili. */
export type WeaponSlot = 'PRIMARY' | 'SECONDARY';

/**
 * Durata in tick del cooldown di quick-switch.
 * Deriva da balance.ts (unico punto di verità dei valori di gameplay):
 * a TICK_HZ = 60, 0.35 s → 21 tick.
 *
 * Nota: prima era un letterale `20` con un commento che assumeva 30 tick/s,
 * quindi documentava 0.67 s mentre il valore reale era 0.33 s.
 */
const SWAP_COOLDOWN_TICKS = COMBAT.weaponSwapCooldownTicks;

/** Snapshot immutabile da passare all'HUD e ai sistemi di combattimento. */
export interface WeaponSlotSnapshot {
  readonly activeSlot:       WeaponSlot;
  readonly primary:          WeaponRuntimeSnapshot | null;
  readonly secondary:        WeaponRuntimeSnapshot | null;
  readonly swapCooldownTick: number;  // tick rimanenti al prossimo swap permesso
  readonly canSwap:          boolean;
}

/** Snapshot di un singolo runtime arma. */
export interface WeaponRuntimeSnapshot {
  readonly id:               string;
  readonly name:             string;
  readonly damageHp:         number;
  readonly intervalTicks:    number;
  readonly durabilityRemaining: number;
  readonly durabilityRatio:  number;  // 0–1
  readonly isBroken:         boolean;
}

// ── Utilità ───────────────────────────────────────────────────────────────────

function runtimeToSnapshot(rt: WeaponRuntime): WeaponRuntimeSnapshot {
  return {
    id:                   rt.definition.id,
    name:                 rt.definition.name,
    damageHp:             rt.definition.damageHp,
    intervalTicks:        rt.definition.intervalTicks,
    durabilityRemaining:  rt.durabilityRemaining,
    durabilityRatio:      getDurabilityRatio(rt),
    isBroken:             isWeaponBroken(rt),
  };
}

// ── WeaponSlotManager ─────────────────────────────────────────────────────────

/**
 * Gestore a due slot per le armi del giocatore.
 *
 * Uso tipico:
 * ```ts
 * const mgr = new WeaponSlotManager();
 * mgr.equip('PRIMARY',   FIST_DEFINITION);
 * mgr.equip('SECONDARY', KHOPESH_DEFINITION);
 *
 * // In risposta all'input del giocatore:
 * mgr.swapWeapons();   // cambia slot attivo se il cooldown è scaduto
 *
 * // Nel loop di simulazione:
 * mgr.step();
 * const snap = mgr.snapshot();
 * combatSystem.attack(snap.primary);
 * hudSystem.updateWeapon(snap);
 * ```
 */
export class WeaponSlotManager {
  private _slots: Record<WeaponSlot, WeaponRuntime | null> = {
    PRIMARY:   null,
    SECONDARY: null,
  };
  private _activeSlot:       WeaponSlot = 'PRIMARY';
  private _swapCooldown = 0;
  private _tick = 0;

  // ── Equipaggiamento ─────────────────────────────────────────────────────────

  /**
   * Equipa un'arma in uno slot.
   * Sostituisce l'arma precedente (se presente) senza cooldown aggiuntivo.
   *
   * @param slot       - Lo slot in cui equipaggiare l'arma.
   * @param definition - Definizione statica dell'arma.
   */
  equip(slot: WeaponSlot, definition: WeaponDefinition): void {
    this._slots[slot] = createWeaponRuntime(definition);
  }

  /**
   * Rimuove l'arma da uno slot.
   *
   * @param slot - Lo slot da svuotare.
   */
  unequip(slot: WeaponSlot): void {
    this._slots[slot] = null;
  }

  // ── Cambio arma ─────────────────────────────────────────────────────────────

  /**
   * Prova a scambiare lo slot attivo.
   * Il cambio è eseguito solo se il cooldown è esaurito e lo slot alternativo
   * non è vuoto o se si vuole comunque passare allo slot vuoto.
   *
   * @param forceEmpty - Se true, permette lo switch anche verso uno slot vuoto.
   * @returns true se lo swap è avvenuto.
   */
  swapWeapons(forceEmpty = false): boolean {
    if (this._swapCooldown > 0) return false;

    const targetSlot: WeaponSlot =
      this._activeSlot === 'PRIMARY' ? 'SECONDARY' : 'PRIMARY';

    if (!forceEmpty && this._slots[targetSlot] === null) return false;

    this._activeSlot  = targetSlot;
    this._swapCooldown = SWAP_COOLDOWN_TICKS;
    return true;
  }

  /**
   * Forza lo slot attivo senza cooldown (usato al caricamento del salvataggio).
   *
   * @param slot - Slot da attivare.
   */
  setActiveSlot(slot: WeaponSlot): void {
    this._activeSlot  = slot;
    this._swapCooldown = 0;
  }

  // ── Arma attiva ─────────────────────────────────────────────────────────────

  /** Restituisce il WeaponRuntime dell'arma attiva, o null se lo slot è vuoto. */
  get activeWeapon(): WeaponRuntime | null {
    return this._slots[this._activeSlot];
  }

  /** Restituisce il WeaponRuntime dell'arma in un dato slot. */
  getWeaponInSlot(slot: WeaponSlot): WeaponRuntime | null {
    return this._slots[slot];
  }

  /** Slot attualmente attivo. */
  get activeSlot(): WeaponSlot {
    return this._activeSlot;
  }

  // ── Durabilità ───────────────────────────────────────────────────────────────

  /**
   * Consuma durabilità dall'arma attiva.
   * Se l'arma si rompe emette un side-effect passivo (non lancia eccezioni).
   *
   * @param amount            - Quantità di durabilità consumata.
   * @param armoredMultiplier - Moltiplicatore (es. 2.0 contro armatura pesante).
   * @returns true se l'arma è ancora integra dopo il consumo.
   */
  consumeActiveWeaponDurability(
    amount:            number,
    armoredMultiplier = 1,
  ): boolean {
    const weapon = this.activeWeapon;
    if (!weapon) return false;
    return consumeDurability(weapon, amount, armoredMultiplier);
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────

  /**
   * Avanza di un tick.
   * Decrementa il cooldown di swap e aggiorna il contatore interno.
   * Chiamare una volta per frame logico di simulazione.
   */
  step(): void {
    this._tick++;
    if (this._swapCooldown > 0) this._swapCooldown--;
  }

  // ── Query ─────────────────────────────────────────────────────────────────────

  /** true se il prossimo swapWeapons() avrebbe successo. */
  get canSwap(): boolean {
    return this._swapCooldown === 0;
  }

  /** Tick rimanenti al prossimo swap. */
  get swapCooldownRemaining(): number {
    return this._swapCooldown;
  }

  /** Tick totali avanzati dall'inizio della sessione. */
  get tick(): number {
    return this._tick;
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  /** Restituisce uno snapshot completo dello stato per HUD e sistemi di rendering. */
  snapshot(): WeaponSlotSnapshot {
    const primary   = this._slots.PRIMARY;
    const secondary = this._slots.SECONDARY;

    return {
      activeSlot:       this._activeSlot,
      primary:          primary   ? runtimeToSnapshot(primary)   : null,
      secondary:        secondary ? runtimeToSnapshot(secondary) : null,
      swapCooldownTick: this._swapCooldown,
      canSwap:          this.canSwap,
    };
  }

  // ── Serializzazione ──────────────────────────────────────────────────────────

  /**
   * Restituisce un oggetto serializzabile per il salvataggio della sessione.
   * Contiene solo gli id e la durabilità rimanente (la definizione completa
   * viene riletta da content/weapons.ts al caricamento).
   */
  serialize(): {
    activeSlot:         WeaponSlot;
    primaryId:          string | null;
    primaryDurability:  number | null;
    secondaryId:        string | null;
    secondaryDurability: number | null;
  } {
    const p = this._slots.PRIMARY;
    const s = this._slots.SECONDARY;
    return {
      activeSlot:          this._activeSlot,
      primaryId:           p ? p.definition.id : null,
      primaryDurability:   p ? p.durabilityRemaining : null,
      secondaryId:         s ? s.definition.id : null,
      secondaryDurability: s ? s.durabilityRemaining : null,
    };
  }
}
