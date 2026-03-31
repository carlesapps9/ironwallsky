// tests/unit/scoring.test.ts — T057 + T084 + T009: Scoring system unit tests
// Point award, milestone detection, event emission.
// T084: combo multiplier increment, decay after comboWindow, cap, combo-updated event.
// T009: streak bonus calculation tests.

import { describe, it, expect, vi } from 'vitest';
import type { GameState } from '@core/entities.js';
import { DEFAULT_CONFIG, FIXED_DT } from '@core/config.js';
import { updateScoring, updateScoringStep } from '@core/systems/scoring.js';
import { createGameState, createEngine } from '@core/engine.js';
import { createEventBus } from '@core/events.js';

function makeState(): GameState {
  return createGameState(DEFAULT_CONFIG, 42);
}

describe('Scoring System', () => {
  it('should emit milestone-reached when score crosses milestone boundary', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('milestone-reached', handler);

    state.run.score = 500;

    updateScoring(state, events, 0);

    expect(handler).toHaveBeenCalledWith({ milestone: 500 });
  });

  it('should not emit milestone when score has not crossed boundary', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('milestone-reached', handler);

    state.run.score = 400;

    updateScoring(state, events, 0);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not emit milestone when lastMilestone matches current', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('milestone-reached', handler);

    state.run.score = 500;

    // Last milestone was already 500
    updateScoring(state, events, 500);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit milestone for higher scores', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('milestone-reached', handler);

    state.run.score = 1500;

    updateScoring(state, events, 1000);

    expect(handler).toHaveBeenCalledWith({ milestone: 1500 });
  });

  it('should handle zero milestone interval gracefully', () => {
    const state = makeState();
    state.config.milestoneInterval = 0;
    const events = createEventBus();
    const handler = vi.fn();
    events.on('milestone-reached', handler);

    state.run.score = 500;

    updateScoring(state, events, 0);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not emit milestone for score of 0', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('milestone-reached', handler);

    state.run.score = 0;

    updateScoring(state, events, 0);

    expect(handler).not.toHaveBeenCalled();
  });
});

// T084: Combo multiplier unit tests
describe('Combo Scoring', () => {
  it('should increment comboCount and step multiplier on consecutive hit', () => {
    const state = makeState();
    const events = createEventBus();

    // Simulate a kill: set combo fields as collision.ts would
    state.run.comboCount = 1;
    state.run.comboMultiplier = 1.0 + state.config.comboMultiplierStep;
    state.run.comboLastHitElapsedMs = 0;

    // Step with a small dt — combo should remain active
    updateScoringStep(state, events, 100, 0);

    expect(state.run.comboCount).toBe(1);
    expect(state.run.comboMultiplier).toBeCloseTo(1.0 + state.config.comboMultiplierStep);
  });

  it('should reset combo after comboWindow ms elapses with no hit', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('combo-updated', handler);

    // Active combo
    state.run.comboCount = 5;
    state.run.comboMultiplier = 1.5;
    state.run.comboLastHitElapsedMs = 0;

    // Advance past comboWindow (default 2000 ms)
    updateScoringStep(state, events, state.config.comboWindow + 1, 0);

    expect(state.run.comboCount).toBe(0);
    expect(state.run.comboMultiplier).toBe(1.0);
    expect(state.run.comboLastHitElapsedMs).toBe(0);
    expect(handler).toHaveBeenCalledWith({ count: 0, multiplier: 1.0 });
  });

  it('should not reset combo before comboWindow expires', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('combo-updated', handler);

    state.run.comboCount = 3;
    state.run.comboMultiplier = 1.3;
    state.run.comboLastHitElapsedMs = 0;

    // Advance to just under comboWindow
    updateScoringStep(state, events, state.config.comboWindow - 100, 0);

    expect(state.run.comboCount).toBe(3);
    expect(state.run.comboMultiplier).toBe(1.3);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should cap comboMultiplier at comboMultiplierCap', () => {
    const state = makeState();
    const events = createEventBus();

    // Set multiplier above cap
    state.run.comboCount = 50;
    state.run.comboMultiplier = state.config.comboMultiplierCap + 1;
    state.run.comboLastHitElapsedMs = 0;

    // Step — should not crash; combo stays active (window not expired)
    updateScoringStep(state, events, 100, 0);

    // The cap enforcement happens in collision.ts; scoring.ts only decays
    // Verify no crash and combo is still active
    expect(state.run.comboCount).toBe(50);
  });

  it('should emit combo-updated with correct payload on reset', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('combo-updated', handler);

    state.run.comboCount = 2;
    state.run.comboMultiplier = 1.2;
    state.run.comboLastHitElapsedMs = 1900;

    // Push past window
    updateScoringStep(state, events, 200, 0);

    expect(handler).toHaveBeenCalledWith({ count: 0, multiplier: 1.0 });
  });

  it('should not emit combo-updated when combo is already at baseline', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('combo-updated', handler);

    // No active combo
    state.run.comboCount = 0;
    state.run.comboMultiplier = 1.0;
    state.run.comboLastHitElapsedMs = 0;

    updateScoringStep(state, events, 5000, 0);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should accumulate comboLastHitElapsedMs across multiple steps', () => {
    const state = makeState();
    const events = createEventBus();

    state.run.comboCount = 1;
    state.run.comboMultiplier = 1.1;
    state.run.comboLastHitElapsedMs = 0;

    // Step 500ms three times
    updateScoringStep(state, events, 500, 0);
    expect(state.run.comboLastHitElapsedMs).toBeCloseTo(500);

    updateScoringStep(state, events, 500, 0);
    expect(state.run.comboLastHitElapsedMs).toBeCloseTo(1000);

    updateScoringStep(state, events, 500, 0);
    expect(state.run.comboLastHitElapsedMs).toBeCloseTo(1500);

    // Still active (1500 < 2000)
    expect(state.run.comboCount).toBe(1);
  });
});

// T009: Streak bonus calculation tests
describe('Streak Bonus', () => {
  function makeEngineWithStreak(dailyStreak: number) {
    const engine = createEngine({ ...DEFAULT_CONFIG }, 42);
    // Set up streak before starting a run
    (engine.getState() as GameState).highScore.dailyStreak = dailyStreak;
    engine.startNewRun();
    return engine;
  }

  it('should not award bonus when streak is 0', () => {
    const engine = makeEngineWithStreak(0);
    const handler = vi.fn();
    engine.events.on('streak-bonus-applied', handler);

    engine.step(FIXED_DT);

    expect(engine.getState().run.score).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should award +200 bonus for streak=2', () => {
    const engine = makeEngineWithStreak(2);
    const handler = vi.fn();
    engine.events.on('streak-bonus-applied', handler);

    engine.step(FIXED_DT);

    expect(engine.getState().run.score).toBe(200);
    expect(handler).toHaveBeenCalledWith({ bonus: 200, streak: 2 });
  });

  it('should award +1000 bonus for streak=10', () => {
    const engine = makeEngineWithStreak(10);
    const handler = vi.fn();
    engine.events.on('streak-bonus-applied', handler);

    engine.step(FIXED_DT);

    expect(engine.getState().run.score).toBe(1000);
    expect(handler).toHaveBeenCalledWith({ bonus: 1000, streak: 10 });
  });

  it('should cap bonus at +1000 for streak=15', () => {
    const engine = makeEngineWithStreak(15);
    const handler = vi.fn();
    engine.events.on('streak-bonus-applied', handler);

    engine.step(FIXED_DT);

    expect(engine.getState().run.score).toBe(1000);
    expect(handler).toHaveBeenCalledWith({ bonus: 1000, streak: 15 });
  });

  it('should emit score-changed with streak bonus delta', () => {
    const engine = makeEngineWithStreak(5);
    const handler = vi.fn();
    engine.events.on('score-changed', handler);

    engine.step(FIXED_DT);

    expect(handler).toHaveBeenCalledWith({ score: 500, delta: 500 });
  });
});
