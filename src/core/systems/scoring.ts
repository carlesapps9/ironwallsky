// src/core/systems/scoring.ts — Scoring system (US1)
// Awards points on enemy-destroyed, tracks score, checks milestones.
// T070: advances comboLastHitElapsedMs each step; resets combo when window expires.
// NEVER uses setTimeout — combo timeout is driven by the per-step dt accumulator (Constitution Rule 7).

import type { GameState } from '../entities.js';
import type { GameEventBus } from '../events.js';

/**
 * Check for milestone thresholds and advance combo decay timer.
 * Score changes and combo increments are handled in collision.ts.
 * @param state - Current game state.
 * @param events - Event bus for emitting milestone/combo-updated events.
 * @param lastMilestone - The last milestone value that was emitted.
 */
export function updateScoring(
  state: GameState,
  events: GameEventBus,
  lastMilestone: number,
): void {
  const config = state.config;
  const run = state.run;
  const score = run.score;

  // T070: advance combo decay timer using fixed-step dt (NO setTimeout)
  // dt is baked into each call of updateScoring from fixedStep in engine.ts
  // We advance via the engine step's dt passed through the engine loop;
  // scoring.ts increments comboLastHitElapsedMs by receiving the dt from fixedStep.
  // The engine calls updateScoringStep(state, events, dt, lastMilestone) — see below.

  if (config.milestoneInterval <= 0) return;

  const currentMilestone =
    Math.floor(score / config.milestoneInterval) * config.milestoneInterval;

  if (currentMilestone > lastMilestone && currentMilestone > 0) {
    events.emit('milestone-reached', { milestone: currentMilestone });
  }
}

/**
 * T070 overload that also advances the combo decay timer by dt.
 * Called from engine fixedStep with the per-step delta.
 * @param state - Current game state (mutated in place for combo fields).
 * @param events - Event bus.
 * @param dt - Fixed timestep delta in ms.
 * @param lastMilestone - The last milestone value that was emitted.
 */
export function updateScoringStep(
  state: GameState,
  events: GameEventBus,
  dt: number,
  lastMilestone: number,
): void {
  const run = state.run;
  const config = state.config;

  // Advance combo elapsed timer
  if (run.comboCount > 0) {
    // T008: Track best combo multiplier achieved this run
    run.bestComboMultiplier = Math.max(run.bestComboMultiplier, run.comboMultiplier);

    run.comboLastHitElapsedMs += dt;
    if (run.comboLastHitElapsedMs > config.comboWindow) {
      // Window expired — reset combo to baseline
      run.comboCount = 0;
      run.comboMultiplier = 1.0;
      run.comboLastHitElapsedMs = 0;
      events.emit('combo-updated', { count: 0, multiplier: 1.0 });
    }
  }

  // Milestone check (delegated)
  updateScoring(state, events, lastMilestone);
}
