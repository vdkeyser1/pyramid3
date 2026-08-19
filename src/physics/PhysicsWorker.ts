/**
 * P-05 — Physics Web Worker entry point.
 *
 * Questo file viene eseguito in un Web Worker separato.
 * Carica Rapier WASM, mantiene il mondo fisico e risponde ai messaggi
 * del thread principale via PhysicsWorkerBridge.
 *
 * Protocollo messaggi (WorkerCommand → WorkerResponse):
 *   INIT    → inizializza Rapier e crea il mondo
 *   STEP    → avanza la simulazione di dt secondi, risponde con STEPPED
 *   ADD_BODY    → aggiunge un rigid body, risponde con BODY_ADDED
 *   REMOVE_BODY → rimuove un rigid body
 *   GET_STATE   → risponde con WORLD_STATE (tutti i body handles e transform)
 *   RESET   → svuota il mondo
 *
 * Vincolo: nessun import dal main thread — il worker è completamente autonomo.
 * Il modulo Rapier viene inizializzato via `init()` prima di qualsiasi uso.
 *
 * @module PhysicsWorker
 */

// Import lazy-loaded tramite dynamic import dopo init()
import RAPIER from '@dimforge/rapier3d-compat';

// ── Tipi messaggi ─────────────────────────────────────────────────────────────

export type WorkerCommandKind =
  | 'INIT'
  | 'STEP'
  | 'ADD_BODY'
  | 'REMOVE_BODY'
  | 'GET_STATE'
  | 'RESET';

export type WorkerResponseKind =
  | 'READY'
  | 'STEPPED'
  | 'BODY_ADDED'
  | 'BODY_REMOVED'
  | 'WORLD_STATE'
  | 'ERROR';

export interface WorkerCommand {
  readonly kind:    WorkerCommandKind;
  readonly id?:     string;           // correlation id
  readonly payload?: unknown;
}

export interface WorkerResponse {
  readonly kind:    WorkerResponseKind;
  readonly id?:     string;
  readonly payload?: unknown;
}

// Payload specifici
export interface AddBodyPayload {
  readonly bodyId:   number;         // ID assegnato dal chiamante
  readonly bodyType: 'dynamic' | 'kinematic' | 'fixed';
  readonly position: [number, number, number];
  readonly rotation: [number, number, number, number];  // quaternion xyzw
  readonly colliderKind: 'ball' | 'capsule' | 'cuboid';
  readonly colliderParams: number[];  // ball: [r], capsule: [hh, r], cuboid: [hx, hy, hz]
}

export interface StepPayload {
  readonly dt: number;
}

export interface BodyStateEntry {
  readonly bodyId:   number;
  readonly x: number; readonly y: number; readonly z: number;
  readonly qx: number; readonly qy: number; readonly qz: number; readonly qw: number;
}

export interface WorldStatePayload {
  readonly bodies: readonly BodyStateEntry[];
}

// ── Stato interno ─────────────────────────────────────────────────────────────

let world:     RAPIER.World | null = null;
const bodyMap = new Map<number, RAPIER.RigidBody>();

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleInit(): void {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  postResponse({ kind: 'READY' });
}

/** Aggiunge `id` alla risposta solo se definito (exactOptionalPropertyTypes). */
function resp<T extends WorkerResponse>(base: Omit<T, 'id'>, id?: string): WorkerResponse {
  return id !== undefined ? { ...base, id } : base;
}

function handleStep(payload: StepPayload, id?: string): void {
  if (!world) {
    postError('STEP: world non inizializzato', id);
    return;
  }
  world.timestep = payload.dt;
  world.step();
  postResponse(resp({ kind: 'STEPPED' }, id));
}

function handleAddBody(payload: AddBodyPayload, id?: string): void {
  if (!world) { postError('ADD_BODY: world non inizializzato', id); return; }

  let bodyDesc: RAPIER.RigidBodyDesc;
  switch (payload.bodyType) {
    case 'dynamic':    bodyDesc = RAPIER.RigidBodyDesc.dynamic();    break;
    case 'kinematic':  bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased(); break;
    case 'fixed':      bodyDesc = RAPIER.RigidBodyDesc.fixed();      break;
  }

  const [px, py, pz]      = payload.position;
  const [qx, qy, qz, qw] = payload.rotation;
  bodyDesc.setTranslation(px, py, pz);
  bodyDesc.setRotation({ x: qx, y: qy, z: qz, w: qw });

  const body = world.createRigidBody(bodyDesc);

  let colliderDesc: RAPIER.ColliderDesc;
  // colliderParams è number[]: la destrutturazione produce `number | undefined`.
  // Validiamo per tipo di collider invece di forzare con `!` — un payload
  // malformato deve dare un errore esplicito, non un collider degenere.
  const [cp0, cp1, cp2] = payload.colliderParams;
  switch (payload.colliderKind) {
    case 'ball':
      if (cp0 === undefined) {
        postError('ADD_BODY: ball richiede 1 parametro [raggio]', id);
        return;
      }
      colliderDesc = RAPIER.ColliderDesc.ball(cp0);
      break;
    case 'capsule':
      if (cp0 === undefined || cp1 === undefined) {
        postError('ADD_BODY: capsule richiede 2 parametri [semi-altezza, raggio]', id);
        return;
      }
      colliderDesc = RAPIER.ColliderDesc.capsule(cp0, cp1);
      break;
    case 'cuboid':
      if (cp0 === undefined || cp1 === undefined || cp2 === undefined) {
        postError('ADD_BODY: cuboid richiede 3 parametri [hx, hy, hz]', id);
        return;
      }
      colliderDesc = RAPIER.ColliderDesc.cuboid(cp0, cp1, cp2);
      break;
  }
  world.createCollider(colliderDesc, body);

  bodyMap.set(payload.bodyId, body);
  postResponse(resp({ kind: 'BODY_ADDED', payload: { bodyId: payload.bodyId } }, id));
}

function handleRemoveBody(bodyId: number, id?: string): void {
  if (!world) { postError('REMOVE_BODY: world non inizializzato', id); return; }
  const body = bodyMap.get(bodyId);
  if (body) {
    world.removeRigidBody(body);
    bodyMap.delete(bodyId);
  }
  postResponse(resp({ kind: 'BODY_REMOVED', payload: { bodyId } }, id));
}

function handleGetState(id?: string): void {
  if (!world) { postError('GET_STATE: world non inizializzato', id); return; }

  const bodies: BodyStateEntry[] = [];
  for (const [bodyId, body] of bodyMap) {
    const t = body.translation();
    const r = body.rotation();
    bodies.push({
      bodyId,
      x: t.x, y: t.y, z: t.z,
      qx: r.x, qy: r.y, qz: r.z, qw: r.w,
    });
  }

  postResponse(resp({ kind: 'WORLD_STATE', payload: { bodies } }, id));
}

function handleReset(id?: string): void {
  if (world) {
    world.free();
    world = null;
  }
  bodyMap.clear();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  postResponse(resp({ kind: 'READY' }, id));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function postResponse(resp: WorkerResponse): void {
  (self as unknown as Worker).postMessage(resp);
}

function postError(message: string, id?: string): void {
  postResponse(id !== undefined
    ? { kind: 'ERROR', id, payload: { message } }
    : { kind: 'ERROR', payload: { message } });
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  await RAPIER.init();  // Inizializza il WASM di Rapier

  (self as unknown as Worker).addEventListener('message', (event: MessageEvent<WorkerCommand>) => {
    const { kind, id, payload } = event.data;
    switch (kind) {
      case 'INIT':        handleInit(); break;
      case 'STEP':        handleStep(payload as StepPayload, id); break;
      case 'ADD_BODY':    handleAddBody(payload as AddBodyPayload, id); break;
      case 'REMOVE_BODY': handleRemoveBody((payload as { bodyId: number }).bodyId, id); break;
      case 'GET_STATE':   handleGetState(id); break;
      case 'RESET':       handleReset(id); break;
      default:
        postError(`Comando sconosciuto: ${String(kind)}`, id);
    }
  });

  // Notifica che il worker è pronto a ricevere comandi
  handleInit();
}

bootstrap().catch((err: unknown) => {
  postError(`bootstrap fallito: ${String(err)}`);
});
