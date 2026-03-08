// tests/unit/engine.test.ts — T058 + T087: Game engine unit tests
// FSM transitions, fixed-timestep, auto-fire, breach, game-over, spiral-of-death cap.
// T087: grantRevive, grantScoreDouble, retry-from-continue-offer paths.

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

  // T087: Revive, Score Double, and Retry-from-continue tests
  describe('Revive (grantRevive)', () => {
    function toContOffer(engine: ReturnType<typeof makeEngine>) {
      engine.startNewRun();
      engine.step(FIXED_DT); // → playing
      const state = engine.getState() as any;
      state.run.phase = 'continue-offer';
      state.run.remainingLives = 0;
    }

    it('should set remainingLives=1 and reviveAvailable=false on grantRevive', () => {
      const engine = makeEngine();
      toContOffer(engine);

      engine.grantRevive();

      expect(engine.getState().run.remainingLives).toBe(1);
      expect(engine.getState().player.remainingLives).toBe(1);
      expect(engine.getState().run.reviveAvailable).toBe(false);
    });

    it('should transition continue-offer → playing on grantRevive', () => {
      const engine = makeEngine();
      toContOffer(engine);
      const handler = vi.fn();
      engine.events.on('run-phase-changed', handler);

      engine.grantRevive();

      expect(engine.getState().run.phase).toBe('playing');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'continue-offer', to: 'playing' }),
      );
    });

    it('should emit revive-granted event', () => {
      const engine = makeEngine();
      toContOffer(engine);
      const handler = vi.fn();
      engine.events.on('revive-granted', handler);

      engine.grantRevive();

      expect(handler).toHaveBeenCalledWith({ remainingLives: 1 });
    });

    it('should no-op grantRevive when not in continue-offer phase', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT); // → playing

      engine.grantRevive(); // wrong phase

      expect(engine.getState().run.phase).toBe('playing');
      expect(engine.getState().run.reviveAvailable).toBe(true); // unchanged
    });

    it('should no-op grantRevive when reviveAvailable is false', () => {
      const engine = makeEngine();
      toContOffer(engine);
      (engine.getState() as any).run.reviveAvailable = false;

      engine.grantRevive();

      // Still in continue-offer, no transition
      expect(engine.getState().run.phase).toBe('continue-offer');
    });
  });

  describe('Score Double (grantScoreDouble)', () => {
    function toContOffer(engine: ReturnType<typeof makeEngine>) {
      engine.startNewRun();
      engine.step(FIXED_DT);
      const state = engine.getState() as any;
      state.run.phase = 'continue-offer';
      state.run.remainingLives = 0;
      state.run.score = 500;
      state.player.score = 500;
    }

    it('should double run.score and set doublersUsed=true', () => {
      const engine = makeEngine();
      toContOffer(engine);

      engine.grantScoreDouble();

      expect(engine.getState().run.score).toBe(1000);
      expect(engine.getState().run.doublersUsed).toBe(true);
    });

    it('should emit score-doubled with correct payload', () => {
      const engine = makeEngine();
      toContOffer(engine);
      const handler = vi.fn();
      engine.events.on('score-doubled', handler);

      engine.grantScoreDouble();

      expect(handler).toHaveBeenCalledWith({ newScore: 1000, originalScore: 500 });
    });

    it('should NOT update bestScore (doubling is post-run display only)', () => {
      const engine = makeEngine();
      toContOffer(engine);
      // Set a bestScore lower than doubled score to ensure it isn't updated
      (engine.getState() as any).highScore.bestScore = 800;

      engine.grantScoreDouble();

      expect(engine.getState().highScore.bestScore).toBe(800); // unchanged
    });

    it('should no-op grantScoreDouble when not in continue-offer phase', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT);
      (engine.getState() as any).run.score = 500;

      engine.grantScoreDouble();

      expect(engine.getState().run.score).toBe(500); // unchanged
      expect(engine.getState().run.doublersUsed).toBe(false);
    });

    it('should no-op grantScoreDouble when doublersUsed already true', () => {
      const engine = makeEngine();
      toContOffer(engine);
      (engine.getState() as any).run.doublersUsed = true;

      engine.grantScoreDouble();

      expect(engine.getState().run.score).toBe(500); // unchanged
    });
  });

  describe('Retry from continue-offer', () => {
    it('startNewRun from continue-offer transitions to starting (new run)', () => {
      const engine = makeEngine();
      engine.startNewRun();
      engine.step(FIXED_DT);
      const state = engine.getState() as any;
      state.run.phase = 'continue-offer';

      engine.startNewRun();

      expect(engine.getState().run.phase).toBe('starting');
      expect(engine.getState().run.score).toBe(0);
      expect(engine.getState().run.reviveAvailable).toBe(true);
      expect(engine.getState().run.doublersUsed).toBe(false);
      expect(engine.getState().player.remainingLives).toBe(DEFAULT_CONFIG.maxLives);
    });
  });
});
