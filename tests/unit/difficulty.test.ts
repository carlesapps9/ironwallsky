// tests/unit/difficulty.test.ts — T056: Difficulty system unit tests
// Level increment, multiplier scaling, max cap.

import { describe, it, expect, vi } from 'vitest';
import type { GameState } from '@core/entities.js';
import { DEFAULT_CONFIG } from '@core/config.js';
import { updateDifficulty } from '@core/systems/difficulty.js';
import { createGameState } from '@core/engine.js';
import { createEventBus } from '@core/events.js';

function makeState(): GameState {
  return createGameState(DEFAULT_CONFIG, 42);
}

describe('Difficulty System', () => {
  it('should not increment level before interval elapses', () => {
    const state = makeState();
    const events = createEventBus();

    const result = updateDifficulty(state, events, 0);

    expect(state.run.currentDifficultyLevel).toBe(0);
    expect(result.timer).toBe(0);
  });

  it('should increment level after interval elapses', () => {
    const state = makeState();
    const events = createEventBus();

    const timer = state.config.difficultyStepIntervalMs + 1;
    updateDifficulty(state, events, timer);

    expect(state.run.currentDifficultyLevel).toBe(1);
  });

  it('should increment multiple levels if enough time passed', () => {
    const state = makeState();
    const events = createEventBus();

    const timer = state.config.difficultyStepIntervalMs * 3 + 1;
    updateDifficulty(state, events, timer);

    expect(state.run.currentDifficultyLevel).toBe(3);
  });

  it('should not exceed max difficulty level', () => {
    const state = makeState();
    const events = createEventBus();

    const timer = state.config.difficultyStepIntervalMs * 100;
    updateDifficulty(state, events, timer);

    expect(state.run.currentDifficultyLevel).toBe(state.config.maxDifficultyLevel);
  });

  it('should emit difficulty-increased event', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('difficulty-increased', handler);

    const timer = state.config.difficultyStepIntervalMs + 1;
    updateDifficulty(state, events, timer);

    expect(handler).toHaveBeenCalledWith({ level: 1 });
  });

  it('should emit multiple events for multiple level ups', () => {
    const state = makeState();
    const events = createEventBus();
    const handler = vi.fn();
    events.on('difficulty-increased', handler);

    const timer = state.config.difficultyStepIntervalMs * 3 + 1;
    updateDifficulty(state, events, timer);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, { level: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { level: 2 });
    expect(handler).toHaveBeenNthCalledWith(3, { level: 3 });
  });

  it('should return remaining timer after level increment', () => {
    const state = makeState();
    const events = createEventBus();

    const timer = state.config.difficultyStepIntervalMs + 500;
    const result = updateDifficulty(state, events, timer);

    expect(result.timer).toBeCloseTo(500, 0);
  });

  it('should not emit events when already at max level', () => {
    const state = makeState();
    const events = createEventBus();
    state.run.currentDifficultyLevel = state.config.maxDifficultyLevel;
    const handler = vi.fn();
    events.on('difficulty-increased', handler);

    updateDifficulty(state, events, state.config.difficultyStepIntervalMs * 10);

    expect(handler).not.toHaveBeenCalled();
  });
});
