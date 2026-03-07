// src/core/clock.ts — Injectable clock interface (Constitution Principle II)

/** Injectable clock for deterministic time control. */
export interface GameClock {
  /** Returns current elapsed time in ms. */
  getCurrentTime(): number;
  /** Returns delta since last tick in ms. */
  getDelta(): number;
}

/**
 * Creates a simulated clock for testing.
 * Time advances only when explicitly ticked.
 */
export function createSimulatedClock(): GameClock & {
  tick(deltaMs: number): void;
  reset(): void;
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
    tick(deltaMs: number): void {
      delta = deltaMs;
      currentTime += deltaMs;
    },
    reset(): void {
      currentTime = 0;
      delta = 0;
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
    update(deltaMs: number): void {
      delta = deltaMs;
      currentTime += deltaMs;
    },
  };
}
