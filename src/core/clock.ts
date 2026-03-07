// src/core/clock.ts — Injectable clock interface (Constitution Principle II)

/** Injectable clock for deterministic time control. */
export interface GameClock {
  /** Returns current elapsed time in ms. */
  getCurrentTime(): number;
  /** Returns delta since last tick in ms. */
  getDelta(): number;
  /** Returns current ISO YYYY-MM-DD date string. Implementation lives in adapter layer (Constitution Principle I). */
  getDateString(): string;
}

/**
 * Creates a simulated clock for testing.
 * Time advances only when explicitly ticked.
 */
export function createSimulatedClock(initialDateString = '2000-01-01'): GameClock & {
  tick(deltaMs: number): void;
  reset(): void;
  setDateString(date: string): void;
} {
  let currentTime = 0;
  let delta = 0;
  let dateString = initialDateString;

  return {
    getCurrentTime(): number {
      return currentTime;
    },
    getDelta(): number {
      return delta;
    },
    getDateString(): string {
      return dateString;
    },
    tick(deltaMs: number): void {
      delta = deltaMs;
      currentTime += deltaMs;
    },
    reset(): void {
      currentTime = 0;
      delta = 0;
    },
    setDateString(date: string): void {
      dateString = date;
    },
  };
}

/**
 * Creates a real clock backed by performance.now().
 * Used in production with Phaser's delta.
 */
export function createRealClock(): GameClock & {
  update(deltaMs: number): void;
} {
  let currentTime = 0;
  let delta = 0;

  return {
    getCurrentTime(): number {
      return currentTime;
    },
    getDelta(): number {
      return delta;
    },
    getDateString(): string {
      // Safe: this is the adapter layer — browser Date access is permitted here.
      return new Date().toISOString().slice(0, 10);
    },
    update(deltaMs: number): void {
      delta = deltaMs;
      currentTime += deltaMs;
    },
  };
}
