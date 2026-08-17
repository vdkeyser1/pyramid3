/**
 * Scopo: errori tipizzati per il dominio applicativo. Nessuna stringa libera.
 * Ownership: nessuna. Tipo puro, zero dipendenze.
 *
 * Ogni errore deve avere un code univoco tracciabile nei log e nei test.
 * Mai lanciare AppError — va restituito come Result.
 */
export type ErrorCode =
  | 'INIT_FAILED'
  | 'WEBGPU_UNAVAILABLE'
  | 'WEBGL2_UNAVAILABLE'
  | 'WORKER_FAILED'
  | 'GENERATION_TIMEOUT'
  | 'GENERATION_EXHAUSTED'
  | 'SAVE_CORRUPT'
  | 'SAVE_FULL'
  | 'MIGRATION_FAILED'
  | 'ASSET_LOAD_FAILED'
  | 'PHYSICS_INIT_FAILED'
  | 'AUDIO_CONTEXT_BLOCKED';

export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export function appError(code: ErrorCode, message: string, cause?: unknown): AppError {
  return { code, message, cause };
}

export function formatError(error: AppError): string {
  const causeStr = error.cause !== undefined ? ` (cause: ${error.cause instanceof Error ? error.cause.message : JSON.stringify(error.cause)})` : '';
  return `[${error.code}] ${error.message}${causeStr}`;
}
