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

  /**
   * Returns true for a non-empty ISO date string (YYYY-MM-DD prefix) that
   * parses to a valid date; also accepts '' (never played).
   */
  function isValidDateString(s: string): boolean {
    if (s === '') return true;
    return /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(new Date(s).getTime());
  }

  /**
   * Sanitizes untrusted values loaded from storage.
   * Guards against NaN/Infinity in numeric fields and malformed date strings
   * that would corrupt streak arithmetic or inflate the displayed high score (OWASP A03).
   */
  function sanitizeRecord(record: HighScoreRecord): HighScoreRecord {
    return {
      ...record,
      bestScore: Number.isFinite(record.bestScore) && record.bestScore >= 0
        ? Math.floor(record.bestScore) : 0,
      dailyStreak: Number.isFinite(record.dailyStreak) && record.dailyStreak >= 0
        ? Math.floor(record.dailyStreak) : 0,
      dateAchieved:                isValidDateString(record.dateAchieved)                ? record.dateAchieved                : '',
      lastPlayedDate:              isValidDateString(record.lastPlayedDate)              ? record.lastPlayedDate              : '',
      dailyChallengeCompletedDate: isValidDateString(record.dailyChallengeCompletedDate) ? record.dailyChallengeCompletedDate : '',
    };
  }

  /**
   * Migrates a v1 HighScoreRecord (no streak fields) to v2 by applying
   * zero-value defaults for the three new fields. Returns the record unchanged
   * if it already has v2 fields.
   */
  function migrateRecord(record: HighScoreRecord): HighScoreRecord {
    if (typeof record.dailyStreak === 'number') return record; // already v2
    return {
      ...record,
      dailyStreak: 0,
      lastPlayedDate: '',
      dailyChallengeCompletedDate: '',
    };
  }

  async function loadFromLocalStorage(): Promise<HighScoreRecord | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as HighScoreRecord;
      if (typeof parsed.bestScore === 'number' && typeof parsed.dateAchieved === 'string') {
        return sanitizeRecord(migrateRecord(parsed));
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
        request.onsuccess = () => {
          const raw = request.result ?? null;
          resolve(raw ? sanitizeRecord(migrateRecord(raw as HighScoreRecord)) : null);
        };
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
