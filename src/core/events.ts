// src/core/events.ts — Typed event bus (Constitution Principle I: no Phaser/browser imports)

import type { EntityId, EnemyType, RunPhase } from './entities.js';

// ─── Event Payloads ───

export interface EnemySpawnedEvent {
  id: EntityId;
  x: number;
  y: number;
  enemyType: EnemyType;
  health: number;
}

export interface EnemyDestroyedEvent {
  id: EntityId;
  x: number;
  y: number;
  killedByProjectileId: EntityId;
  scoreAwarded: number;
}

export interface EnemyBreachedEvent {
  id: EntityId;
  x: number;
}

export interface ProjectileFiredEvent {
  id: EntityId;
  x: number;
  y: number;
}

export interface ProjectileDeactivatedEvent {
  id: EntityId;
  reason: 'off-screen' | 'hit-enemy';
}

export interface PlayerMovedEvent {
  x: number;
}

export interface ScoreChangedEvent {
  score: number;
  delta: number;
}

export interface MilestoneReachedEvent {
  milestone: number;
}

export interface HighScoreBeatenEvent {
  newBest: number;
  previous: number;
}

export interface LifeLostEvent {
  remaining: number;
}

export interface RunPhaseChangedEvent {
  from: RunPhase;
  to: RunPhase;
}

export interface DifficultyIncreasedEvent {
  level: number;
}

// ─── Event Type Map ───

/** All event names as a string literal union. */
export type GameEventType =
  | 'enemy-spawned'
  | 'enemy-destroyed'
  | 'enemy-breached'
  | 'projectile-fired'
  | 'projectile-deactivated'
  | 'player-moved'
  | 'score-changed'
  | 'milestone-reached'
  | 'life-lost'
  | 'run-phase-changed'
  | 'difficulty-increased'
  | 'high-score-beaten';

/** Maps each event type to its payload shape. */
export interface GameEventMap {
  'enemy-spawned': EnemySpawnedEvent;
  'enemy-destroyed': EnemyDestroyedEvent;
  'enemy-breached': EnemyBreachedEvent;
  'projectile-fired': ProjectileFiredEvent;
  'projectile-deactivated': ProjectileDeactivatedEvent;
  'player-moved': PlayerMovedEvent;
  'score-changed': ScoreChangedEvent;
  'milestone-reached': MilestoneReachedEvent;
  'life-lost': LifeLostEvent;
  'run-phase-changed': RunPhaseChangedEvent;
  'difficulty-increased': DifficultyIncreasedEvent;
  'high-score-beaten': HighScoreBeatenEvent;
}

// ─── Event Bus Interface ───

/** Typed event bus interface. */
export interface GameEventBus {
  on<K extends GameEventType>(
    event: K,
    handler: (payload: GameEventMap[K]) => void,
  ): void;

  off<K extends GameEventType>(
    event: K,
    handler: (payload: GameEventMap[K]) => void,
  ): void;

  emit<K extends GameEventType>(
    event: K,
    payload: GameEventMap[K],
  ): void;

  /** Remove all handlers (for cleanup). */
  clear(): void;
}

// ─── Event Bus Implementation ───

type HandlerFn = (payload: unknown) => void;

/** Creates a new typed event bus instance. */
export function createEventBus(): GameEventBus {
  const handlers = new Map<GameEventType, Set<HandlerFn>>();

  function on<K extends GameEventType>(
    event: K,
    handler: (payload: GameEventMap[K]) => void,
  ): void {
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)!.add(handler as HandlerFn);
  }

  function off<K extends GameEventType>(
    event: K,
    handler: (payload: GameEventMap[K]) => void,
  ): void {
    const set = handlers.get(event);
    if (set) {
      set.delete(handler as HandlerFn);
    }
  }

  function emit<K extends GameEventType>(
    event: K,
    payload: GameEventMap[K],
  ): void {
    const set = handlers.get(event);
    if (set) {
      for (const handler of set) {
        handler(payload);
      }
    }
  }

  function clear(): void {
    handlers.clear();
  }

  return { on, off, emit, clear };
}
