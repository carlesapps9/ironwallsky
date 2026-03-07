// src/adapters/storage/storage-adapter.ts — Storage adapter (US2)
// Read/write HighScoreRecord to localStorage with IndexedDB fallback.
// Detects storage unavailability and warns.

import type { HighScoreRecord } from '@core/entities.js';

const STORAGE_KEY = 'ironwallsky_highscore';
const DB_NAME = 'IronWallSkyDB';
const STORE_NAME = 'highscores';
const DB_VERSION = 1;

export interface StorageAdapter {
  load(): Promise<HighScoreRecord | null>;
  save(record: HighScoreRecord): Promise<void>;
  isAvailable(): boolean;
}

/** Creates a storage adapter with localStorage primary and IndexedDB fallback. */
export function createStorageAdapter(): StorageAdapter {
  const storageAvailable = checkLocalStorageAvailable();
  const idbAvailable = checkIndexedDBAvailable();

  function checkLocalStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  function checkIndexedDBAvailable(): boolean {
    try {
      return typeof indexedDB !== 'undefined';
    } catch {
      return false;
    }
  }

  async function loadFromLocalStorage(): Promise<HighScoreRecord | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as HighScoreRecord;
      if (typeof parsed.bestScore === 'number' && typeof parsed.dateAchieved === 'string') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function saveToLocalStorage(record: HighScoreRecord): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      console.warn('[Storage] localStorage write failed');
    }
  }

  function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadFromIDB(): Promise<HighScoreRecord | null> {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('highscore');
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function saveToIDB(record: HighScoreRecord): Promise<void> {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record, 'highscore');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      console.warn('[Storage] IndexedDB write failed');
    }
  }

  async function load(): Promise<HighScoreRecord | null> {
    if (storageAvailable) {
      const result = await loadFromLocalStorage();
      if (result) return result;
    }
    if (idbAvailable) {
      return loadFromIDB();
    }
    console.warn('[Storage] No storage available — high scores will not persist (FR-027)');
    return null;
  }

  async function save(record: HighScoreRecord): Promise<void> {
    if (storageAvailable) {
      await saveToLocalStorage(record);
    }
    if (idbAvailable) {
      await saveToIDB(record);
    }
    if (!storageAvailable && !idbAvailable) {
      console.warn('[Storage] No storage available — score not saved');
    }
  }

  function isAvailable(): boolean {
    return storageAvailable || idbAvailable;
  }

  return { load, save, isAvailable };
}
