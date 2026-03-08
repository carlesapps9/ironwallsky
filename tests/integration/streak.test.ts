// tests/integration/streak.test.ts — T089: Daily streak integration tests
// Consecutive day increments streak; same-day re-play does not increment;
// gap > 1 day resets streak to 1. Uses injected clock.getDateString().

import { describe, it, expect } from 'vitest';
import { createEngine } from '@core/engine.js';
import { DEFAULT_CONFIG, FIXED_DT } from '@core/config.js';
import { createSimulatedClock } from '@core/clock.js';

/**
 * Helper: create engine + simulated clock at a given date, play a run to
 * game-over by draining all lives, then return the highScore record.
 */
function playToGameOver(
  clock: ReturnType<typeof createSimulatedClock>,
  seed = 42,
  existingEngine?: ReturnType<typeof createEngine>,
) {
  const engine = existingEngine ?? createEngine({ ...DEFAULT_CONFIG }, seed, clock);
  engine.startNewRun();
  engine.step(FIXED_DT); // → playing

  // Force game-over by depleting lives (white-box: set phase + 0 lives)
  const state = engine.getState() as any;
  state.run.remainingLives = 0;
  state.run.phase = 'continue-offer';
  // Disable continue so it transitions straight to game-over
  state.run.continueUsed = true;
  state.config.continueEnabled = false;

  // Trigger endRun via startNewRun which resets — but we need game-over.
  // Instead, force remainingLives to 1 and let breach happen.
  // Simpler: directly set phase to game-over won't run daily streak logic.
  // The streak logic runs inside endRun() called from handleBreach or
  // when continue-offer transitions to game-over.

  // Re-approach: set lives to 1, make an enemy cross defense line
  const engine2 = createEngine({ ...DEFAULT_CONFIG, continueEnabled: false }, seed, clock);
  engine2.startNewRun();
  engine2.step(FIXED_DT); // → playing

  // Set remaining lives to 1 so next breach triggers game-over
  const s2 = engine2.getState() as any;
  s2.run.remainingLives = 1;
  s2.player.remainingLives = 1;

  // Place an enemy at the defense line to trigger breach
  const enemy = s2.enemies[0];
  enemy.active = true;
  enemy.position.x = 100;
  enemy.position.y = s2.config.defenseLineY; // Will be detected as breach
  enemy.velocity = { x: 0, y: 120 };
  enemy.health = 1;

  // Step so breach detection fires
  engine2.step(FIXED_DT);

  return { engine: engine2, highScore: engine2.getState().highScore };
}

describe('Daily Streak (T089)', () => {
  it('first-ever play sets dailyStreak to 1', () => {
    const clock = createSimulatedClock('2026-03-01');
    const { highScore } = playToGameOver(clock);

    expect(highScore.dailyStreak).toBe(1);
    expect(highScore.lastPlayedDate).toBe('2026-03-01');
  });

  it('same-day re-play does not increment streak', () => {
    const clock = createSimulatedClock('2026-03-01');

    // First run
    const { engine } = playToGameOver(clock);
    expect(engine.getState().highScore.dailyStreak).toBe(1);

    // Second run on same day — use the same engine instance
    // Reset via startNewRun and play again
    engine.startNewRun();
    engine.step(FIXED_DT); // → playing

    const s = engine.getState() as any;
    s.run.remainingLives = 1;
    s.player.remainingLives = 1;
    const enemy = s.enemies.find((e: any) => !e.active);
    if (enemy) {
      enemy.active = true;
      enemy.position = { x: 100, y: s.config.defenseLineY };
      enemy.velocity = { x: 0, y: 120 };
      enemy.health = 1;
    }
    engine.step(FIXED_DT);

    expect(engine.getState().highScore.dailyStreak).toBe(1); // unchanged
    expect(engine.getState().highScore.lastPlayedDate).toBe('2026-03-01');
  });

  it('consecutive day increments streak', () => {
    const clock = createSimulatedClock('2026-03-01');

    // Day 1
    const { engine } = playToGameOver(clock);
    expect(engine.getState().highScore.dailyStreak).toBe(1);

    // Day 2
    clock.setDateString('2026-03-02');
    engine.startNewRun();
    engine.step(FIXED_DT);
    const s = engine.getState() as any;
    s.run.remainingLives = 1;
    s.player.remainingLives = 1;
    const enemy = s.enemies.find((e: any) => !e.active);
    if (enemy) {
      enemy.active = true;
      enemy.position = { x: 100, y: s.config.defenseLineY };
      enemy.velocity = { x: 0, y: 120 };
      enemy.health = 1;
    }
    engine.step(FIXED_DT);

    expect(engine.getState().highScore.dailyStreak).toBe(2);
    expect(engine.getState().highScore.lastPlayedDate).toBe('2026-03-02');
  });

  it('gap > 1 day resets streak to 1', () => {
    const clock = createSimulatedClock('2026-03-01');

    // Day 1
    const { engine } = playToGameOver(clock);
    expect(engine.getState().highScore.dailyStreak).toBe(1);

    // Skip to day 4 (gap of 3 days)
    clock.setDateString('2026-03-04');
    engine.startNewRun();
    engine.step(FIXED_DT);
    const s = engine.getState() as any;
    s.run.remainingLives = 1;
    s.player.remainingLives = 1;
    const enemy = s.enemies.find((e: any) => !e.active);
    if (enemy) {
      enemy.active = true;
      enemy.position = { x: 100, y: s.config.defenseLineY };
      enemy.velocity = { x: 0, y: 120 };
      enemy.health = 1;
    }
    engine.step(FIXED_DT);

    expect(engine.getState().highScore.dailyStreak).toBe(1); // reset
    expect(engine.getState().highScore.lastPlayedDate).toBe('2026-03-04');
  });

  it('multi-day consecutive streak accumulates correctly', () => {
    const clock = createSimulatedClock('2026-03-01');

    const { engine } = playToGameOver(clock);
    expect(engine.getState().highScore.dailyStreak).toBe(1);

    // Days 2–5 consecutive
    for (let day = 2; day <= 5; day++) {
      clock.setDateString(`2026-03-0${day}`);
      engine.startNewRun();
      engine.step(FIXED_DT);
      const s = engine.getState() as any;
      s.run.remainingLives = 1;
      s.player.remainingLives = 1;
      const enemy = s.enemies.find((e: any) => !e.active);
      if (enemy) {
        enemy.active = true;
        enemy.position = { x: 100, y: s.config.defenseLineY };
        enemy.velocity = { x: 0, y: 120 };
        enemy.health = 1;
      }
      engine.step(FIXED_DT);

      expect(engine.getState().highScore.dailyStreak).toBe(day);
    }
  });

  it('uses injected clock.getDateString, not real Date.now()', () => {
    // The simulated clock returns a fixed date — if the engine used real Date,
    // the date would be today, not our injected value.
    const clock = createSimulatedClock('2099-12-31');
    const { highScore } = playToGameOver(clock);

    expect(highScore.lastPlayedDate).toBe('2099-12-31');
  });
});
