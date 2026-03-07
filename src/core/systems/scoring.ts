// src/core/systems/scoring.ts — Scoring system (US1)
// Awards points on enemy-destroyed, tracks score, checks milestones.

import type { GameState } from '../entities.js';
import type { GameEventBus } from '../events.js';

/**
 * Check for milestone thresholds and emit events.
 * Score changes are handled in collision.ts when enemies are destroyed.
 * This system checks if a milestone boundary was crossed.
 *
 * @param state - Current game state.
 * @param events - Event bus for emitting milestone events.
 * @param lastMilestone - The last milestone value that was emitted.
 */
export function updateScoring(
  state: GameState,
  events: GameEventBus,
  lastMilestone: number,
): void {
  const config = state.config;
  const score = state.run.score;

  if (config.milestoneInterval <= 0) return;

  const currentMilestone =
    Math.floor(score / config.milestoneInterval) * config.milestoneInterval;

  if (currentMilestone > lastMilestone && currentMilestone > 0) {
    events.emit('milestone-reached', { milestone: currentMilestone });
  }
}
