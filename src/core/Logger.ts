/**
 * Scopo: logger strutturato con livelli e contesto. Nessuna dipendenza dal DOM.
 * Ownership: read-only dopo init; thread-safe per worker e main thread.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly timestamp: number;
}

export type LogHandler = (entry: LogEntry) => void;

let minLevel: LogLevel = 'INFO';
let handlers: LogHandler[] = [];

export function configureLogger(level: LogLevel, customHandlers?: LogHandler[]): void {
  minLevel = level;
  handlers = [
    (entry: LogEntry): void => {
      const prefix = `[${entry.level}] ${new Date(entry.timestamp).toISOString()}`;
      const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const method = entry.level === 'ERROR' || entry.level === 'FATAL' ? console.error
        : entry.level === 'WARN' ? console.warn
        : console.log;
      method(`${prefix} ${entry.message}${ctx}`);
    },
    ...(customHandlers ?? []),
  ];
}

export function createLogger(context: string) {
  function log(level: LogLevel, message: string, ctx?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const entry: LogEntry = { level, message: `[${context}] ${message}`, timestamp: Date.now() };
    if (ctx !== undefined) {
      (entry as { context: Record<string, unknown> }).context = ctx;
    }
    for (const handler of handlers) handler(entry);
  }

  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => { log('DEBUG', msg, ctx); },
    info: (msg: string, ctx?: Record<string, unknown>) => { log('INFO', msg, ctx); },
    warn: (msg: string, ctx?: Record<string, unknown>) => { log('WARN', msg, ctx); },
    error: (msg: string, ctx?: Record<string, unknown>) => { log('ERROR', msg, ctx); },
    fatal: (msg: string, ctx?: Record<string, unknown>) => { log('FATAL', msg, ctx); },
  };
}

export type Logger = ReturnType<typeof createLogger>;
