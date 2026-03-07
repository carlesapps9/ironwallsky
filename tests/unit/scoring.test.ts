// tests/unit/scoring.test.ts — T057: Scoring system unit tests
// Point award, milestone detection, event emission.

import { describe, it, expect, vi } from 'vitest';
import type { GameState } from '@core/entities.js';
import { DEFAULT_CONFIG } from '@core/config.js';
import { updateScoring } from '@core/systems/scoring.js';
import { createGameState } from '@core/engine.js';
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
