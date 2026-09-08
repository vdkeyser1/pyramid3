/**
 * M-01: Virtual joystick e touch controls per mobile.
 * Overlay DOM leggero; emette assi/pulsanti per InputSystem.setVirtual*.
 */

export interface TouchInputState {
  readonly moveX: number;
  readonly moveZ: number;
  readonly lookDX: number;
  readonly lookDY: number;
  readonly attack: boolean;
  readonly parry: boolean;
  readonly jump: boolean;
  readonly interact: boolean;
  readonly torch: boolean;
}

export interface TouchControls {
  readonly sample: () => TouchInputState;
  mount(parent: HTMLElement): void;
  /** Richiede permesso iOS + attiva DeviceOrientation per look giroscopico. */
  enableGyroscope(): Promise<boolean>;
  dispose(): void;
}

export function createTouchControls(): TouchControls {
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;';

  const state = {
    moveX: 0,
    moveZ: 0,
    lookDX: 0,
    lookDY: 0,
    attack: false,
    parry: false,
    jump: false,
    interact: false,
    torch: false,
  };

  let leftId: number | null = null;
  let rightId: number | null = null;
  let leftOrigin = { x: 0, y: 0 };
  let rightOrigin = { x: 0, y: 0 };
  let gyroEnabled = false;
  let lastBeta: number | null = null;
  let lastGamma: number | null = null;
  let gyroLookDX = 0;
  let gyroLookDY = 0;

  const leftPad = makePad('left');
  const rightPad = makePad('right');
  const btnRow = document.createElement('div');
  btnRow.style.cssText =
    'position:absolute;right:12px;bottom:120px;display:flex;flex-direction:column;gap:8px;pointer-events:auto;';

  const attackBtn = makeButton('ATK', () => { state.attack = true; });
  const parryBtn = makeButton('PAR', () => { state.parry = true; });
  const jumpBtn = makeButton('JMP', () => { state.jump = true; });
  const torchBtn = makeButton('🔥', () => { state.torch = true; });
  const interactBtn = makeButton('USE', () => { state.interact = true; });
  btnRow.append(attackBtn, parryBtn, jumpBtn, torchBtn, interactBtn);
  root.append(leftPad, rightPad, btnRow);

  function makePad(side: 'left' | 'right'): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute',
      'bottom:24px',
      side === 'left' ? 'left:24px' : 'right:120px',
      'width:120px',
      'height:120px',
      'border-radius:60px',
      'background:rgba(236,217,160,0.12)',
      'border:1px solid rgba(236,217,160,0.35)',
      'pointer-events:auto',
      'touch-action:none',
    ].join(';');
    return el;
  }

  function makeButton(label: string, onDown: () => void): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.style.cssText =
      'width:52px;height:52px;border-radius:26px;border:1px solid rgba(236,217,160,0.5);' +
      'background:rgba(20,12,6,0.65);color:#ecd9a0;font:600 11px monospace;pointer-events:auto;';
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onDown();
    });
    return el;
  }

  function onPointerDown(e: PointerEvent): void {
    const target = e.target as HTMLElement;
    if (target === leftPad || leftPad.contains(target)) {
      leftId = e.pointerId;
      leftOrigin = { x: e.clientX, y: e.clientY };
      leftPad.setPointerCapture(e.pointerId);
    } else if (target === rightPad || rightPad.contains(target)) {
      rightId = e.pointerId;
      rightOrigin = { x: e.clientX, y: e.clientY };
      rightPad.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: PointerEvent): void {
    const maxR = 48;
    if (e.pointerId === leftId) {
      const dx = e.clientX - leftOrigin.x;
      const dy = e.clientY - leftOrigin.y;
      state.moveX = Math.max(-1, Math.min(1, dx / maxR));
      state.moveZ = Math.max(-1, Math.min(1, -dy / maxR));
    } else if (e.pointerId === rightId) {
      const dx = e.clientX - rightOrigin.x;
      const dy = e.clientY - rightOrigin.y;
      state.lookDX = Math.max(-1, Math.min(1, dx / maxR)) * 8;
      state.lookDY = Math.max(-1, Math.min(1, dy / maxR)) * 8;
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.pointerId === leftId) {
      leftId = null;
      state.moveX = 0;
      state.moveZ = 0;
    } else if (e.pointerId === rightId) {
      rightId = null;
      state.lookDX = 0;
      state.lookDY = 0;
    }
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);

  function onDeviceOrientation(e: DeviceOrientationEvent): void {
    if (e.beta == null || e.gamma == null) return;
    if (lastBeta !== null && lastGamma !== null) {
      // gamma ≈ yaw (sinistra/destra), beta ≈ pitch (su/giù)
      gyroLookDX += (e.gamma - lastGamma) * 0.55;
      gyroLookDY += (e.beta - lastBeta) * 0.45;
    }
    lastBeta = e.beta;
    lastGamma = e.gamma;
  }

  return {
    sample() {
      const snap: TouchInputState = {
        ...state,
        lookDX: state.lookDX + gyroLookDX,
        lookDY: state.lookDY + gyroLookDY,
      };
      gyroLookDX = 0;
      gyroLookDY = 0;
      // Pulsanti one-shot: si consumano al sample.
      state.attack = false;
      state.parry = false;
      state.jump = false;
      state.interact = false;
      state.torch = false;
      return snap;
    },
    mount(parent) {
      parent.appendChild(root);
    },
    async enableGyroscope() {
      if (gyroEnabled || typeof window === 'undefined') return false;
      try {
        const DOE = DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<PermissionState>;
        };
        if (typeof DOE.requestPermission === 'function') {
          const perm = await DOE.requestPermission();
          if (perm !== 'granted') return false;
        }
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
        gyroEnabled = true;
        return true;
      } catch {
        return false;
      }
    },
    dispose() {
      if (gyroEnabled) {
        window.removeEventListener('deviceorientation', onDeviceOrientation, true);
        gyroEnabled = false;
      }
      root.remove();
    },
  };
}
