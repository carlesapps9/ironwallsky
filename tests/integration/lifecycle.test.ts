// tests/integration/lifecycle.test.ts — T061: App lifecycle integration test
// Background → pause, foreground → resume, orientation change → pause.

import { describe, it, expect, vi } from 'vitest';
import { createEngine } from '@core/engine.js';
import { DEFAULT_CONFIG, FIXED_DT } from '@core/config.js';

describe('App Lifecycle', () => {
  it('should pause run on pauseRun command', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT); // Move to playing

    expect(engine.getState().run.phase).toBe('playing');

    engine.pauseRun();
    expect(engine.getState().run.phase).toBe('paused');
  });

  it('should resume run on resumeRun command', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT);

    engine.pauseRun();
    expect(engine.getState().run.phase).toBe('paused');

    engine.resumeRun();
    expect(engine.getState().run.phase).toBe('playing');
  });

  it('should not advance simulation while paused', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT);

    const elapsedBefore = engine.getState().run.elapsedMs;

    engine.pauseRun();
    engine.step(FIXED_DT * 10);

    expect(engine.getState().run.elapsedMs).toBe(elapsedBefore);
  });

  it('should reset accumulator on resume to prevent time skip', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT);

    engine.pauseRun();
    engine.resumeRun();

    const elapsedBefore = engine.getState().run.elapsedMs;
    engine.step(FIXED_DT);

    // Should only advance by 1 step, not by accumulated pause time
    const elapsedAfter = engine.getState().run.elapsedMs;
    expect(elapsedAfter - elapsedBefore).toBeLessThanOrEqual(FIXED_DT + 1);
  });

  it('should emit run-phase-changed for pause/resume cycle', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    const phaseChanges: Array<{ from: string; to: string }> = [];

    engine.events.on('run-phase-changed', (payload) => {
      phaseChanges.push({ from: payload.from, to: payload.to });
    });

    engine.startNewRun();
    engine.step(FIXED_DT); // starting → playing

    engine.pauseRun(); // playing → paused
    engine.resumeRun(); // paused → playing

    expect(phaseChanges).toEqual([
      { from: 'starting', to: 'playing' },
      { from: 'playing', to: 'paused' },
      { from: 'paused', to: 'playing' },
    ]);
  });

  it('should handle multiple pause/resume cycles', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT);

    for (let i = 0; i < 5; i++) {
      engine.pauseRun();
      expect(engine.getState().run.phase).toBe('paused');

      engine.resumeRun();
      expect(engine.getState().run.phase).toBe('playing');

      engine.step(FIXED_DT);
    }
  });

  it('should ignore pauseRun when not in playing phase', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();

    // Still in 'starting' phase
    engine.pauseRun();
    expect(engine.getState().run.phase).toBe('starting');
  });

  it('should ignore resumeRun when not in paused phase', () => {
    const engine = createEngine(DEFAULT_CONFIG, 42);
    engine.startNewRun();
    engine.step(FIXED_DT);

    // In 'playing' phase
    engine.resumeRun();
    expect(engine.getState().run.phase).toBe('playing');
  });
});
