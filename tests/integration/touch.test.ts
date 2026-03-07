// tests/integration/touch.test.ts — T062: Touch input integration test
// Drag → setPlayerX, clamp to bounds.

import { describe, it, expect, vi } from 'vitest';
import { createEngine } from '@core/engine.js';
import { DEFAULT_CONFIG, FIXED_DT } from '@core/config.js';

describe('Touch Input', () => {
  it('should update player position via setPlayerX', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT);

    engine.setPlayerX(200);

    expect(engine.getState().player.position.x).toBe(200);
  });

  it('should clamp to left bound (x = 0)', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();

    engine.setPlayerX(-50);

    expect(engine.getState().player.position.x).toBe(0);
  });

  it('should clamp to right bound (x = worldWidth)', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();

    engine.setPlayerX(9999);

    expect(engine.getState().player.position.x).toBe(DEFAULT_CONFIG.worldWidth);
  });

  it('should emit player-moved event with clamped position', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    const handler = vi.fn();
    engine.events.on('player-moved', handler);

    engine.setPlayerX(150);

    expect(handler).toHaveBeenCalledWith({ x: 150 });
  });

  it('should emit player-moved with clamped value for out-of-bounds', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    const handler = vi.fn();
    engine.events.on('player-moved', handler);

    engine.setPlayerX(-100);

    expect(handler).toHaveBeenCalledWith({ x: 0 });
  });

  it('should handle rapid position updates', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();

    for (let i = 0; i < 100; i++) {
      engine.setPlayerX(i * 3);
    }

    expect(engine.getState().player.position.x).toBe(Math.min(297, DEFAULT_CONFIG.worldWidth));
  });

  it('should track position between pauses', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT);

    engine.setPlayerX(100);
    engine.pauseRun();
    engine.setPlayerX(200); // Can still set position while paused
    engine.resumeRun();

    expect(engine.getState().player.position.x).toBe(200);
  });
});
