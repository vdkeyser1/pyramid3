/**
 * Scopo: definizioni delle azioni di input e tabella di mapping azione → tasti.
 * Ownership: InputSystem usa ActionMap per tradurre raw input in azioni digitali.
 * Invarianti:
 *   - ogni azione ha un nome univoco;
 *   - ogni binding ha almeno un tasto primario;
 *   - i binding possono essere rimappati a runtime.
 * Failure mode: un'azione non trovata restituisce undefined.
 *
 * Fonti: GDD §7.1 per il default control mapping.
 */

/** Identificatore univoco per ogni azione di input. */
export const ActionKind = {
  // Movimento
  MoveForward: 'MoveForward',
  MoveBackward: 'MoveBackward',
  MoveLeft: 'MoveLeft',
  MoveRight: 'MoveRight',

  // Look
  LookHorizontal: 'LookHorizontal',
  LookVertical: 'LookVertical',

  // Azioni
  Attack: 'Attack',
  Parry: 'Parry',
  Interact: 'Interact',
  Dodge: 'Dodge',
  Crouch: 'Crouch',
  Sprint: 'Sprint',
  Jump: 'Jump',

  // Torcia
  TorchToggle: 'TorchToggle',
  TorchPlace: 'TorchPlace',
  TorchWave: 'TorchWave',
  KaEcho: 'KaEcho',

  // Armi
  WeaponSlot1: 'WeaponSlot1',
  WeaponSlot2: 'WeaponSlot2',
  WeaponSlot3: 'WeaponSlot3',
  WeaponScrollUp: 'WeaponScrollUp',
  WeaponScrollDown: 'WeaponScrollDown',

  // UI
  Map: 'Map',
  Pause: 'Pause',

  // Debug
  DebugOverlay: 'DebugOverlay',
} as const;

export type ActionKind = (typeof ActionKind)[keyof typeof ActionKind];

/** Mappa i code KeyboardEvent.code ai nomi leggibili. */
export const KeyCode = {
  KeyW: 'KeyW',
  KeyA: 'KeyA',
  KeyS: 'KeyS',
  KeyD: 'KeyD',
  KeyE: 'KeyE',
  KeyF: 'KeyF',
  KeyG: 'KeyG',
  KeyQ: 'KeyQ',
  KeyR: 'KeyR',
  Space: 'Space',
  ShiftLeft: 'ShiftLeft',
  ShiftRight: 'ShiftRight',
  ControlLeft: 'ControlLeft',
  ControlRight: 'ControlRight',
  Tab: 'Tab',
  Escape: 'Escape',
  Digit1: 'Digit1',
  Digit2: 'Digit2',
  Digit3: 'Digit3',
  Backquote: 'Backquote',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
} as const;

export type KeyCode = (typeof KeyCode)[keyof typeof KeyCode];

/** Mouse button identifiers. */
export const MouseButton = {
  Left: 0,
  Middle: 1,
  Right: 2,
} as const;

export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton];

/** Un binding può essere un tasto della tastiera o un pulsante del mouse. */
export interface KeyBinding {
  readonly kind: 'key';
  readonly code: KeyCode;
}

export interface MouseBinding {
  readonly kind: 'mouse';
  readonly button: MouseButton;
}

export type Binding = KeyBinding | MouseBinding;

/** Una riga nella action map. */
export interface ActionEntry {
  readonly action: ActionKind;
  readonly label: string;
  readonly bindings: readonly Binding[];
}

/** Action map immutabile con supporto per remapping funzionale. */
export interface ActionMap {
  /** Restituisce l'entry per un'azione, o undefined. */
  get(action: ActionKind): ActionEntry | undefined;

  /** Restituisce tutte le entry. */
  entries(): readonly ActionEntry[];

  /** Cerca l'azione associata a un binding. */
  findByBinding(binding: Binding): ActionEntry | undefined;

  /** Restituisce una nuova ActionMap con il binding primario rimappato. */
  remap(action: ActionKind, bindings: readonly Binding[]): ActionMap;
}

export interface ActionBindingOverride {
  readonly action: ActionKind;
  readonly bindings: readonly Binding[];
}

// ── Default action map (GDD §7.1) ────────────────────────────────────────

const key = (code: KeyCode): KeyBinding => ({ kind: 'key', code });
const mouse = (button: MouseButton): MouseBinding => ({ kind: 'mouse', button });

const DEFAULT_ENTRIES: readonly ActionEntry[] = [
  { action: ActionKind.MoveForward,   label: 'Avanti',         bindings: [key(KeyCode.KeyW), key(KeyCode.ArrowUp)] },
  { action: ActionKind.MoveBackward,  label: 'Indietro',       bindings: [key(KeyCode.KeyS), key(KeyCode.ArrowDown)] },
  { action: ActionKind.MoveLeft,      label: 'Sinistra',       bindings: [key(KeyCode.KeyA), key(KeyCode.ArrowLeft)] },
  { action: ActionKind.MoveRight,     label: 'Destra',         bindings: [key(KeyCode.KeyD), key(KeyCode.ArrowRight)] },
  { action: ActionKind.LookHorizontal,label: 'Guarda Oriz.',   bindings: [] }, // mouse, gestito a parte
  { action: ActionKind.LookVertical,  label: 'Guarda Vert.',   bindings: [] }, // mouse, gestito a parte
  { action: ActionKind.Attack,        label: 'Attacco',        bindings: [mouse(MouseButton.Left)] },
  { action: ActionKind.Parry,         label: 'Parata',         bindings: [mouse(MouseButton.Right)] },
  { action: ActionKind.Interact,      label: 'Interagisci',    bindings: [key(KeyCode.KeyE)] },
  { action: ActionKind.Dodge,         label: 'Schivata',       bindings: [key(KeyCode.Space)] },
  { action: ActionKind.Crouch,        label: 'Acquattati',     bindings: [key(KeyCode.ControlLeft)] },
  { action: ActionKind.Sprint,        label: 'Scatto',         bindings: [key(KeyCode.ShiftLeft)] },
  { action: ActionKind.Jump,          label: 'Salto',          bindings: [key(KeyCode.Space)] },
  { action: ActionKind.TorchToggle,   label: 'Torcia ON/OFF',  bindings: [key(KeyCode.KeyF)] },
  { action: ActionKind.TorchPlace,    label: 'Posa Torcia',    bindings: [key(KeyCode.KeyG)] },
  { action: ActionKind.TorchWave,     label: 'Agita Torcia',   bindings: [key(KeyCode.KeyQ)] },
  { action: ActionKind.KaEcho,        label: 'Eco del Ka',     bindings: [key(KeyCode.KeyR)] },
  { action: ActionKind.WeaponSlot1,   label: 'Arma 1',         bindings: [key(KeyCode.Digit1)] },
  { action: ActionKind.WeaponSlot2,   label: 'Arma 2',         bindings: [key(KeyCode.Digit2)] },
  { action: ActionKind.WeaponSlot3,   label: 'Arma 3',         bindings: [key(KeyCode.Digit3)] },
  { action: ActionKind.WeaponScrollUp, label: 'Arma Succ.',    bindings: [] }, // scroll, gestito a parte
  { action: ActionKind.WeaponScrollDown, label: 'Arma Prec.',  bindings: [] }, // scroll, gestito a parte
  { action: ActionKind.Map,           label: 'Mappa',          bindings: [key(KeyCode.Tab)] },
  { action: ActionKind.Pause,         label: 'Pausa',          bindings: [key(KeyCode.Escape)] },
  { action: ActionKind.DebugOverlay,  label: 'Debug Overlay',  bindings: [key(KeyCode.Backquote)] },
];

function bindingEq(a: Binding, b: Binding): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'key' && b.kind === 'key') return a.code === b.code;
  if (a.kind === 'mouse' && b.kind === 'mouse') return a.button === b.button;
  return false;
}

const KEY_CODE_LABELS: Record<KeyCode, string> = {
  KeyW: 'W',
  KeyA: 'A',
  KeyS: 'S',
  KeyD: 'D',
  KeyE: 'E',
  KeyF: 'F',
  KeyG: 'G',
  KeyQ: 'Q',
  KeyR: 'R',
  Space: 'Spazio',
  ShiftLeft: 'Shift Sin',
  ShiftRight: 'Shift Des',
  ControlLeft: 'Ctrl Sin',
  ControlRight: 'Ctrl Des',
  Tab: 'Tab',
  Escape: 'Esc',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Backquote: '`',
  ArrowUp: 'Freccia Su',
  ArrowDown: 'Freccia Giu',
  ArrowLeft: 'Freccia Sin',
  ArrowRight: 'Freccia Destra',
};

export function isKeyCode(value: string): value is KeyCode {
  return Object.values(KeyCode).includes(value as KeyCode);
}

export function cloneBinding(binding: Binding): Binding {
  if (binding.kind === 'key') {
    return { kind: 'key', code: binding.code };
  }
  return { kind: 'mouse', button: binding.button };
}

export function cloneBindings(bindings: readonly Binding[]): readonly Binding[] {
  return bindings.map((binding) => cloneBinding(binding));
}

export function getDefaultBindingsForAction(action: ActionKind): readonly Binding[] {
  const entry = DEFAULT_ENTRIES.find((candidate) => candidate.action === action);
  return entry ? cloneBindings(entry.bindings) : [];
}

export function applyActionBindingOverrides(
  baseMap: ActionMap,
  overrides: readonly ActionBindingOverride[],
): ActionMap {
  return overrides.reduce(
    (currentMap, override) => currentMap.remap(override.action, cloneBindings(override.bindings)),
    baseMap,
  );
}

export function formatBinding(binding: Binding): string {
  if (binding.kind === 'key') {
    return KEY_CODE_LABELS[binding.code];
  }
  if (binding.button === MouseButton.Left) {
    return 'Mouse Sinistro';
  }
  if (binding.button === MouseButton.Right) {
    return 'Mouse Destro';
  }
  return 'Mouse Centrale';
}

export function formatBindings(bindings: readonly Binding[]): string {
  if (bindings.length === 0) {
    return 'Non assegnato';
  }
  return bindings.map((binding) => formatBinding(binding)).join(' / ');
}

export function createActionMap(): ActionMap {
  const entries = [...DEFAULT_ENTRIES];

  function get(action: ActionKind): ActionEntry | undefined {
    return entries.find((e) => e.action === action);
  }

  function entriesFn(): readonly ActionEntry[] {
    return entries;
  }

  function findByBinding(binding: Binding): ActionEntry | undefined {
    return entries.find((e) => e.bindings.some((b) => bindingEq(b, binding)));
  }

  function remap(action: ActionKind, bindings: readonly Binding[]): ActionMap {
    const newEntries = entries.map((e) =>
      e.action === action ? { ...e, bindings } : e,
    );
    // Restituisce una nuova istanza con i nuovi binding
    const map: ActionMap = {
      get: (a: ActionKind): ActionEntry | undefined =>
        newEntries.find((e) => e.action === a),
      entries: (): readonly ActionEntry[] => newEntries,
      findByBinding: (b: Binding): ActionEntry | undefined =>
        newEntries.find((e) => e.bindings.some((x) => bindingEq(x, b))),
      remap: (a: ActionKind, bs: readonly Binding[]): ActionMap => {
        const newer = newEntries.map((e) =>
          e.action === a ? { ...e, bindings: bs } : e,
        );
        return createActionMapFrom(newer);
      },
    };
    return map;
  }

  return { get, entries: entriesFn, findByBinding, remap };
}

function createActionMapFrom(
  entries: readonly ActionEntry[],
): ActionMap {
  return {
    get: (a: ActionKind): ActionEntry | undefined =>
      entries.find((e) => e.action === a),
    entries: (): readonly ActionEntry[] => entries,
    findByBinding: (b: Binding): ActionEntry | undefined =>
      entries.find((e) => e.bindings.some((x) => bindingEq(x, b))),
    remap: (a: ActionKind, bs: readonly Binding[]): ActionMap =>
      createActionMapFrom(
        entries.map((e) => (e.action === a ? { ...e, bindings: bs } : e)),
      ),
  };
}
