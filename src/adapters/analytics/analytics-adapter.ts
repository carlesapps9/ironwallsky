// src/adapters/analytics/analytics-adapter.ts — Analytics adapter (US4)
// Fire-and-forget event tracking. Silent failure per FR-021. No PII per constitution rule 40.

import type { GameEventBus } from '@core/events.js';

export interface AnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

export interface AnalyticsAdapter {
  /** Track a custom event (fire-and-forget). */
  track(event: AnalyticsEvent): void;

  /** Subscribe to game events for automatic tracking. */
  subscribeToGameEvents(events: GameEventBus): void;
}

/**
 * Creates an analytics adapter.
 * In production, this would send events to a backend or analytics SDK.
 * For now, logs to console (useful for debugging).
 */
export function createAnalyticsAdapter(): AnalyticsAdapter {
  function track(event: AnalyticsEvent): void {
    try {
      // Fire-and-forget — silent failure per FR-021
      console.debug('[Analytics]', event.name, event.params ?? '');
    } catch {
      // Silent failure — never interrupt gameplay
    }
  }

  function subscribeToGameEvents(events: GameEventBus): void {
    events.on('run-phase-changed', (payload) => {
      if (payload.to === 'game-over') {
        track({ name: 'run_complete', params: { from: payload.from } });
      }
    });

    events.on('milestone-reached', (payload) => {
      track({ name: 'milestone', params: { value: payload.milestone } });
    });

    events.on('high-score-beaten', (payload) => {
      track({
        name: 'high_score',
        params: { newBest: payload.newBest, previous: payload.previous },
      });
    });

    events.on('difficulty-increased', (payload) => {
      track({ name: 'difficulty_up', params: { level: payload.level } });
    });
  }

  return { track, subscribeToGameEvents };
}
