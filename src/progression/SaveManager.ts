/**
 * Scopo: persistenza del profilo giocatore tramite IndexedDB.
 * Ownership: GameApplication. Salva a ogni transizione piano, morte, acquisto.
 *
 * Schema versionato con migrazione transazionale.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod/v4';

// ─── Schema ───

export const SaveSchema = z.object({
  schemaVersion: z.number(),
  contentVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  checksum: z.string(),
  payload: z.object({
    fragments: z.number().default(0),
    pyramidsUnlocked: z.number().default(1),
    bestiaryEntries: z.array(z.string()).default([]),
    discoveredGrafts: z.array(z.string()).default([]),
    kaNodes: z.array(z.string()).default([]),
    claimedTreasureSiteIds: z.array(z.string()).default([]),
    completedFloorIds: z.array(z.string()).default([]),
    settings: z.record(z.string(), z.unknown()).default({}),
  }),
});

export type SaveData = z.infer<typeof SaveSchema>;

const DB_NAME = 'la-piramide-perduta';
const DB_VERSION = 1;
const SCHEMA_VERSION = 1;
const CONTENT_VERSION = '0.1.0';

// ─── API ───

export interface SaveManager {
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<void>;
  exists(): Promise<boolean>;
  dispose(): void;
}

interface SaveRecord extends SaveData {
  id: 'current';
}

interface SaveDatabase extends DBSchema {
  profile: {
    key: string;
    value: SaveRecord;
  };
  runs: {
    key: string;
    value: { id: string };
  };
}

let dbPromise: Promise<IDBPDatabase<SaveDatabase>> | null = null;

function getDb(): Promise<IDBPDatabase<SaveDatabase>> {
  dbPromise ??= openDB<SaveDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('runs')) {
        db.createObjectStore('runs', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

export function createSaveManager(): SaveManager {
  let disposed = false;

  return {
    async load(): Promise<SaveData> {
      const db = await getDb();
      const raw = await db.get('profile', 'current');
      if (!raw) {
        return createDefaultSave();
      }
      return SaveSchema.parse(raw);
    },

    async save(data: SaveData): Promise<void> {
      if (disposed) return;
      const db = await getDb();
      const updated: SaveData = {
        ...data,
        updatedAt: new Date().toISOString(),
        checksum: simpleChecksum(JSON.stringify(data.payload)),
      };
      SaveSchema.parse(updated); // valida prima di scrivere
      await db.put('profile', { ...updated, id: 'current' });
    },

    async exportJson(): Promise<string> {
      const data = await this.load();
      return JSON.stringify(data, null, 2);
    },

    async importJson(json: string): Promise<void> {
      const parsed: unknown = JSON.parse(json);
      const data = SaveSchema.parse(parsed);
      await this.save(data);
    },

    async exists(): Promise<boolean> {
      const db = await getDb();
      const raw = await db.get('profile', 'current');
      return raw !== undefined;
    },

    dispose(): void {
      disposed = true;
      if (dbPromise) {
        dbPromise
          .then((db) => {
            db.close();
          })
          .catch(() => undefined);
        dbPromise = null;
      }
    },
  };
}

function createDefaultSave(): SaveData {
  const now = new Date().toISOString();
  const payload = {
    fragments: 0,
    pyramidsUnlocked: 1,
    bestiaryEntries: [],
    discoveredGrafts: [],
    kaNodes: [],
    claimedTreasureSiteIds: [],
      completedFloorIds: [],
    settings: {},
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    createdAt: now,
    updatedAt: now,
    checksum: simpleChecksum(JSON.stringify(payload)),
    payload,
  };
}

function simpleChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
