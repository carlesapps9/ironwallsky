// src/core/systems/difficulty.ts — Difficulty system (US1)
// Increments level on timer, scales spawn rate + enemy speed + health.

import type { GameState } from '../entities.js';
import type { GameEventBus } from '../events.js';

export interface DifficultyResult {
  timer: number;
}

/**
 * Check and apply difficulty level increments.
 * @param state - Current game state (mutated in place).
 * @param events - Event bus for emitting difficulty events.
 * @param timer - Accumulated time since last difficulty check.
 * @returns Updated timer value.
 */
export function updateDifficulty(
  state: GameState,
  events: GameEventBus,
  timer: number,
): DifficultyResult {
  const config = state.config;

  if (state.run.currentDifficultyLevel >= config.maxDifficultyLevel) {
    return { timer };
  }

  while (
    timer >= config.difficultyStepIntervalMs &&
    state.run.currentDifficultyLevel < config.maxDifficultyLevel
  ) {
    timer -= config.difficultyStepIntervalMs;
    state.run.currentDifficultyLevel++;

    events.emit('difficulty-increased', {
      level: state.run.currentDifficultyLevel,
    });
  }

  return { timer };
}
