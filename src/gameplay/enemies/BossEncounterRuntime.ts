/**
 * G-02 — Runtime di stato per gli scontri boss.
 *
 * Scopo: macchina a stati che traccia HP, fase corrente e comportamenti del boss
 *        durante un singolo scontro. È un oggetto puramente di simulazione — no
 *        Three.js, no performance.now(), no dipendenze di rendering.
 * Ownership: istanziato da BossSpawnSystem al momento dell'ingresso nell'arena;
 *        distrutto alla fine dello scontro (vittoria o morte del giocatore).
 *
 * Invarianti:
 *   - hp è sempre in [0, maxHp];
 *   - phase segue la sequenza INTRO → PHASE_1 → PHASE_2 → ENRAGE → DEFEATED;
 *   - l'arena è bloccata da INTRO fino a DEFEATED;
 *   - tick è incrementato solo da step(), mai dall'esterno.
 */

import {
  type BossTemplate,
  type BossPhase,
  type BossPhaseConfig,
  BOSS_TEMPLATES,
} from '@/content/bossTemplates.js';

// ── Tipi pubblici ─────────────────────────────────────────────────────────────

/** Snapshot leggibile dell'incontro boss, passato ai sistemi di rendering e UI. */
export interface BossEncounterSnapshot {
  readonly bossType:          string;
  readonly bossName:          string;
  readonly hp:                number;
  readonly maxHp:             number;
  readonly hpFraction:        number;   // 0–1
  readonly phase:             BossPhase;
  readonly ticksInPhase:      number;
  readonly arenaLocked:       boolean;
  readonly isDefeated:        boolean;
  readonly activePatterns:    readonly string[];
}

/** Evento emesso al cambio di fase. */
export interface BossPhaseChangedEvent {
  readonly previousPhase: BossPhase;
  readonly newPhase:      BossPhase;
  readonly tick:          number;
}

/** Evento emesso alla sconfitta del boss. */
export interface BossDefeatedEvent {
  readonly bossType:       string;
  readonly totalTicksFight: number;
  readonly rewards:        readonly string[];
}

export type BossEventListener<T> = (event: T) => void;

// ── BossEncounterRuntime ──────────────────────────────────────────────────────

/**
 * Macchina a stati per un incontro boss.
 *
 * Uso tipico:
 * ```ts
 * const boss = BossEncounterRuntime.create('KHEPRI_GUARDIAN');
 * boss.onPhaseChanged((evt) => animateBossPhaseTransition(evt));
 * boss.onDefeated((evt) => grantRewards(evt.rewards));
 *
 * // Nel loop di simulazione:
 * boss.step();
 * boss.applyDamage(playerDamage);
 * const snap = boss.snapshot();
 * hudSystem.updateBossBar(snap);
 * ```
 */
export class BossEncounterRuntime {
  private readonly _template:        BossTemplate;
  private _hp:                       number;
  private _phase:                    BossPhase;
  private _phaseConfig:              BossPhaseConfig;
  private _ticksInPhase:             number;
  private _totalTicks:               number;
  private _arenaLocked:              boolean;

  private readonly _onPhaseChanged:  BossEventListener<BossPhaseChangedEvent>[] = [];
  private readonly _onDefeated:      BossEventListener<BossDefeatedEvent>[]     = [];

  // ── Costruzione ─────────────────────────────────────────────────────────────

  private constructor(template: BossTemplate, introPhase: BossTemplate['phases'][number]) {
    this._template      = template;
    this._hp            = template.maxHp;
    this._arenaLocked   = true;
    this._totalTicks    = 0;
    this._ticksInPhase  = 0;
    this._phase         = 'INTRO';
    // La fase INTRO è validata da create(): qui è garantita presente.
    this._phaseConfig   = introPhase;
  }

  /**
   * Crea un nuovo incontro boss a partire dall'ID di tipo.
   *
   * @throws Error se il tipo boss non è registrato in BOSS_TEMPLATES,
   *         o se il template non definisce la fase INTRO obbligatoria.
   */
  static create(bossType: string): BossEncounterRuntime {
    const template = BOSS_TEMPLATES.get(bossType);
    if (!template) {
      throw new Error(`BossEncounterRuntime: tipo sconosciuto "${bossType}"`);
    }
    // Ogni boss parte da INTRO: un template senza quella fase è malformato e
    // va segnalato qui, non mascherato con un non-null assertion nel costruttore.
    const introPhase = template.phases.find((p) => p.phase === 'INTRO');
    if (!introPhase) {
      throw new Error(`BossEncounterRuntime: template "${bossType}" senza fase INTRO`);
    }
    return new BossEncounterRuntime(template, introPhase);
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get hp():            number     { return this._hp; }
  get maxHp():         number     { return this._template.maxHp; }
  get hpFraction():    number     { return this._hp / this._template.maxHp; }
  get phase():         BossPhase  { return this._phase; }
  get ticksInPhase():  number     { return this._ticksInPhase; }
  get totalTicks():    number     { return this._totalTicks; }
  get arenaLocked():   boolean    { return this._arenaLocked; }
  get isDefeated():    boolean    { return this._phase === 'DEFEATED'; }
  get bossType():      string     { return this._template.type; }

  /** Velocità di movimento corrente (frazione del valore base). */
  get movementSpeedMultiplier(): number {
    return this._phaseConfig.movementSpeedMultiplier;
  }

  /** Moltiplicatore danno corrente. */
  get damageMultiplier(): number {
    return this._phaseConfig.damageMultiplier;
  }

  /** Pattern d'attacco disponibili nella fase corrente. */
  get activePatterns(): readonly string[] {
    return this._phaseConfig.attackPatterns;
  }

  // ── Avanzamento di tick ──────────────────────────────────────────────────────

  /**
   * Avanza il runtime di un tick.
   * Deve essere chiamato dal sistema di simulazione una volta per frame logico.
   * NON usa performance.now() — il tempo è in tick.
   */
  step(): void {
    if (this._phase === 'DEFEATED') return;

    this._totalTicks++;
    this._ticksInPhase++;

    this._checkPhaseTransition();
  }

  // ── Danno ────────────────────────────────────────────────────────────────────

  /**
   * Applica danno al boss.
   * Se gli HP scendono a zero, passa a DEFEATED.
   *
   * @param amount - Punti danno grezzi (già applicati moltiplicatori dal chiamante).
   */
  applyDamage(amount: number): void {
    if (this._phase === 'DEFEATED' || this._phase === 'INTRO') return;

    this._hp = Math.max(0, this._hp - amount);

    if (this._hp === 0) {
      this._transitionTo('DEFEATED');
    } else {
      this._checkPhaseTransition();
    }
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  /** Restituisce uno snapshot immutabile dello stato corrente. */
  snapshot(): BossEncounterSnapshot {
    return {
      bossType:       this._template.type,
      bossName:       this._template.name,
      hp:             this._hp,
      maxHp:          this._template.maxHp,
      hpFraction:     this.hpFraction,
      phase:          this._phase,
      ticksInPhase:   this._ticksInPhase,
      arenaLocked:    this._arenaLocked,
      isDefeated:     this.isDefeated,
      activePatterns: this.activePatterns,
    };
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  /** Registra un listener per cambio di fase. Restituisce la funzione di cleanup. */
  onPhaseChanged(listener: BossEventListener<BossPhaseChangedEvent>): () => void {
    this._onPhaseChanged.push(listener);
    return () => {
      const idx = this._onPhaseChanged.indexOf(listener);
      if (idx !== -1) this._onPhaseChanged.splice(idx, 1);
    };
  }

  /** Registra un listener per la sconfitta del boss. Restituisce la funzione di cleanup. */
  onDefeated(listener: BossEventListener<BossDefeatedEvent>): () => void {
    this._onDefeated.push(listener);
    return () => {
      const idx = this._onDefeated.indexOf(listener);
      if (idx !== -1) this._onDefeated.splice(idx, 1);
    };
  }

  // ── Logica interna ───────────────────────────────────────────────────────────

  /** Controlla se le condizioni per una transizione di fase sono soddisfatte. */
  private _checkPhaseTransition(): void {
    if (this._phase === 'DEFEATED') return;

    const phases     = this._template.phases;
    const currentIdx = phases.findIndex((p) => p.phase === this._phase);

    // Scorre le fasi successive in ordine (esclude INTRO e DEFEATED)
    for (let i = currentIdx + 1; i < phases.length; i++) {
      const candidate = phases[i];
      if (!candidate || candidate.phase === 'DEFEATED') continue;

      // Transizione se l'HP è sceso sotto la soglia E la durata minima è trascorsa
      if (
        this.hpFraction <= candidate.hpFraction &&
        this._ticksInPhase >= (phases[currentIdx]?.minDurationTicks ?? 0)
      ) {
        this._transitionTo(candidate.phase);
        return;
      }
    }
  }

  /** Esegue la transizione a una nuova fase ed emette gli eventi. */
  private _transitionTo(newPhase: BossPhase): void {
    const previousPhase = this._phase;
    this._phase         = newPhase;
    this._ticksInPhase  = 0;

    const newConfig = this._template.phases.find((p) => p.phase === newPhase);
    if (newConfig) this._phaseConfig = newConfig;

    // Sblocca l'arena solo quando il boss è sconfitto
    if (newPhase === 'DEFEATED') {
      this._arenaLocked = false;
      for (const listener of this._onDefeated) {
        listener({
          bossType:        this._template.type,
          totalTicksFight: this._totalTicks,
          rewards:         this._template.defeatRewards,
        });
      }
      return;
    }

    const evt: BossPhaseChangedEvent = {
      previousPhase,
      newPhase,
      tick: this._totalTicks,
    };
    for (const listener of this._onPhaseChanged) {
      listener(evt);
    }
  }
}
