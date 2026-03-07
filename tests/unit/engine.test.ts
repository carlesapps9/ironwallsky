// tests/unit/engine.test.ts — T058: Game engine unit tests
// FSM transitions, fixed-timestep, auto-fire, breach, game-over, spiral-of-death cap.

import { describe, it, expect, vi } from 'vitest';
import { createEngine } from '@core/engine.js';
import { DEFAULT_CONFIG, FIXED_DT, MAX_ACCUMULATOR } from '@core/config.js';

function makeEngine(seed = 42) {
  return createEngine({ ...DEFAULT_CONFIG }, seed);
}

describe('Game Engine', () => {
  describe('FSM Transitions', () => {
    it('should start in "starting" phase', () => {
      const engine = makeEngine();
      engine.startNewRun();
      expect(engine.getState().run.phase).toBe('starting');
    });

    it('should transition to "playing" on first step', () => {
      const engine = makeEngine();
      engine.startNewRun();
      const handler = vi.fn();
      engine.events.on('run-phase-changed', handler);

      engine.step(FIXED_DT);

      expect(engine.getState().run.phase).toBe('playing');
      expect(handler).toHaveBeenCalled();
    });

    it('should transition to "paused" on pauseRun', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT); // Move to playing

      engine.pauseRun();

      expect(engine.getState().run.phase).toBe('paused');
    });

    it('should transition from "paused" to "playing" on resumeRun', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT);

      engine.pauseRun();
      engine.resumeRun();

      expect(engine.getState().run.phase).toBe('playing');
    });

    it('should not step simulation when paused', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT);

      const elapsed = engine.getState().run.elapsedMs;
      engine.pauseRun();
      engine.step(FIXED_DT * 10);

      expect(engine.getState().run.elapsedMs).toBe(elapsed);
    });
  });

  describe('Fixed timestep', () => {
    it('should accumulate time and step in fixed increments', () => {
      const engine = makeEngine();
      engine.startNewRun();

      engine.step(FIXED_DT * 2.5);

      // Should have stepped 2 times (2 × FIXED_DT worth of simulation)
      const elapsed = engine.getState().run.elapsedMs;
      expect(elapsed).toBeCloseTo(FIXED_DT * 2, 1);
    });
  });

  describe('Spiral of death prevention', () => {
    it('should cap accumulator to prevent runaway simulation', () => {
      const engine = makeEngine();
      engine.startNewRun();

      // Feed huge delta (simulates tab switch)
      engine.step(10000);

      // Should cap at MAX_ACCUMULATOR / FIXED_DT steps
      const maxSteps = Math.ceil(MAX_ACCUMULATOR / FIXED_DT);
      const elapsed = engine.getState().run.elapsedMs;
      expect(elapsed).toBeLessThanOrEqual(maxSteps * FIXED_DT + 1);
    });
  });

  describe('Auto-fire', () => {
    it('should fire projectile when cooldown reaches 0', () => {
      const engine = makeEngine();
      engine.startNewRun();
      const fired = vi.fn();
      engine.events.on('projectile-fired', fired);

      // Step enough for a projectile to fire
      engine.step(FIXED_DT);

      expect(fired).toHaveBeenCalled();
    });
  });

  describe('Player commands', () => {
    it('should clamp setPlayerX to world bounds', () => {
      const engine = makeEngine();
      engine.startNewRun();

      engine.setPlayerX(-100);
      expect(engine.getState().player.position.x).toBe(0);

      engine.setPlayerX(9999);
      expect(engine.getState().player.position.x).toBe(DEFAULT_CONFIG.worldWidth);
    });

    it('should emit player-moved on setPlayerX', () => {
      const engine = makeEngine();
      engine.startNewRun();
      const handler = vi.fn();
      engine.events.on('player-moved', handler);

      engine.setPlayerX(100);

      expect(handler).toHaveBeenCalledWith({ x: 100 });
    });
  });

  describe('New run', () => {
    it('should reset state on startNewRun', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT * 60); // Simulate for a while

      const prevScore = engine.getState().run.score;
      engine.startNewRun();

      expect(engine.getState().run.score).toBe(0);
      expect(engine.getState().run.phase).toBe('starting');
      expect(engine.getState().player.remainingLives).toBe(DEFAULT_CONFIG.maxLives);
    });

    it('should increment runIndex on startNewRun', () => {
      const engine = makeEngine();
      engine.startNewRun();
      expect(engine.getState().run.runIndex).toBe(1);

      engine.startNewRun();
      expect(engine.getState().run.runIndex).toBe(2);
    });
  });

  describe('Continue', () => {
    it('should grant continue from continue-offer phase', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT); // Move to playing

      // Manually trigger continue-offer scenario
      // This is hard to trigger naturally, so we test via engine state
      const state = engine.getState() as { run: { phase: string; remainingLives: number; continueUsed: boolean } };
      // Force state (white-box test)
      state.run.phase = 'continue-offer' as any;
      state.run.remainingLives = 0;

      engine.grantContinue();

      expect(engine.getState().run.continueUsed).toBe(true);
      expect(engine.getState().run.remainingLives).toBe(1);
    });
  });
});
