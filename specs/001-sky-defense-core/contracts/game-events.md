# Contracts — Game Events

**Branch**: `001-sky-defense-core` | **Date**: 2026-02-28 | **Phase**: 1

This document defines the typed event bus contract between `src/core/`
(publisher) and `src/adapters/` (subscribers). The event bus is the **only**
communication channel from core → adapters. Adapters never import core
internals directly; they subscribe to events and read payloads.

---

## Design Principles

1. **Core publishes, adapters subscribe** — unidirectional data flow.
2. **Adapters send commands to core** via a thin command interface
   (e.g., `engine.handleInput(command)`) — NOT via the event bus.
3. **Events are fire-and-forget** — the core does not wait for adapter
   acknowledgment.
4. **Payloads are plain objects** — no class instances, no Phaser types,
   no functions. Must be JSON-serializable for future replay support.
5. **Event names are string literals** — typed via a discriminated union
   for compile-time safety.

---

## Event Type Definition

```typescript
// src/core/events.ts

/** All event names as a string literal union. */
type GameEventType =
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
  | 'high-score-beaten'
  | 'combo-updated'
  | 'revive-granted'
  | 'score-doubled';

/** Maps each event type to its payload shape. */
interface GameEventMap {
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
  'combo-updated': ComboUpdatedEvent;
  'revive-granted': ReviveGrantedEvent;
  'score-doubled': ScoreDoubledEvent;
}

/** Typed event bus interface. */
interface GameEventBus {
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
}
```

---

## Event Payloads

### Enemy Events

```typescript
interface EnemySpawnedEvent {
  /** Snapshot of the newly activated enemy. */
  id: EntityId;
  x: number;
  y: number;
  enemyType: EnemyType;
  health: number;
}

interface EnemyDestroyedEvent {
  /** ID of the destroyed enemy. */
  id: EntityId;
  /** Position at destruction (for visual effect placement). */
  x: number;
  y: number;
  /** ID of the projectile that dealt the killing blow. */
  killedByProjectileId: EntityId;
  /** Score value awarded. */
  scoreAwarded: number;
}

interface EnemyBreachedEvent {
  /** ID of the enemy that reached the defense line. */
  id: EntityId;
  x: number;
}
```

### Projectile Events

```typescript
interface ProjectileFiredEvent {
  id: EntityId;
  /** Spawn position (player's x, fixed y above player). */
  x: number;
  y: number;
}

interface ProjectileDeactivatedEvent {
  /** ID of the deactivated projectile. */
  id: EntityId;
  /** Reason for deactivation. */
  reason: 'off-screen' | 'hit-enemy';
}
```

### Player Events

```typescript
interface PlayerMovedEvent {
  /** New horizontal position. */
  x: number;
}
```

### Scoring Events

```typescript
interface ScoreChangedEvent {
  /** New total score. */
  score: number;
  /** Points added in this event. */
  delta: number;
}

interface MilestoneReachedEvent {
  /** Milestone value crossed (e.g., 500, 1000, 1500). */
  milestone: number;
}

interface HighScoreBeatenEvent {
  /** New personal best. */
  newBest: number;
  /** Previous personal best. */
  previous: number;
}
```

### Amendment Events (2026-03-07)

```typescript
interface ComboUpdatedEvent {
  /** Current consecutive-hit count; 0 means combo was reset to baseline. */
  count: number;
  /** Current score multiplier; 1.0 = baseline (no bonus). */
  multiplier: number;
}

interface ReviveGrantedEvent {
  /** Lives remaining after the revive — always 1 per FR-019. */
  remainingLives: number;
}

interface ScoreDoubledEvent {
  /** New (doubled) displayed session score. Does NOT affect bestScore comparison. */
  newScore: number;
  /** Original pre-doubling score. */
  originalScore: number;
}
```

### Life Events

```typescript
interface LifeLostEvent {
  /** Lives remaining after this breach. */
  remaining: number;
}
```

### Run Lifecycle Events

```typescript
interface RunPhaseChangedEvent {
  from: RunPhase;
  to: RunPhase;
}
```

### Difficulty Events

```typescript
interface DifficultyIncreasedEvent {
  /** New difficulty level. */
  level: number;
}
```

---

## Input Commands (Adapters → Core)

Adapters send player input to the core via a command interface. Commands
are **not** events — they are synchronous method calls on the engine.

```typescript
/** Commands that adapters can send to the core engine. */
interface EngineCommands {
  /** Update player horizontal position from touch/drag input. */
  setPlayerX(x: number): void;

  /** Request a new run (retry from game-over). */
  startNewRun(): void;

  /** Pause the current run (backgrounded, orientation change). */
  pauseRun(): void;

  /** Resume from pause (foreground + user tap). */
  resumeRun(): void;

  /** Rewarded ad completed — grant Watch to Continue (one extra life). */
  grantContinue(): void;

  /** Revive Shield rewarded ad completed — restore 1 life, set reviveAvailable = false. */
  grantRevive(): void;

  /** Score Doubler rewarded ad completed — double displayed session score; bestScore comparison unaffected. */
  grantScoreDouble(): void;
}
```

---

## Adapter Subscription Guide

### Phaser Play Scene

| Subscribe To | Action |
|-------------|--------|
| `enemy-spawned` | Activate pooled sprite, set position + texture |
| `enemy-destroyed` | Play destruction animation, return sprite to pool |
| `enemy-breached` | Screen shake, flash effect |
| `projectile-fired` | Activate pooled projectile sprite, muzzle flash |
| `projectile-deactivated` | Return projectile sprite to pool |
| `player-moved` | Sync player sprite x-position |
| `score-changed` | Update HUD score text |
| `milestone-reached` | Trigger celebration VFX |
| `life-lost` | Remove heart/shield icon from HUD |
| `difficulty-increased` | (Optional) visual intensity change |

### Phaser Game Over Scene

| Subscribe To | Action |
|-------------|--------|
| `run-phase-changed` (→ continue-offer) | Show continue-offer UI; render Watch to Continue, Revive Shield, Score Doubler, Share Card buttons (gated by run flags) |
| `run-phase-changed` (→ game-over) | Show final game-over UI; render Share Card button only |
| `high-score-beaten` | Highlight new record with distinct animation |
| `revive-granted` | Hide continue-offer UI; return to active play |
| `score-doubled` | Update displayed score with doubled value |

### Audio Adapter

| Subscribe To | Action |
|-------------|--------|
| `projectile-fired` | Play shoot SFX |
| `enemy-destroyed` | Play explosion SFX |
| `enemy-breached` | Play breach warning SFX |
| `milestone-reached` | Play celebration SFX |
| `life-lost` | Play damage SFX |

### Ad Adapter

| Subscribe To | Action |
|-------------|--------|
| `run-phase-changed` (→ game-over) | Check interstitial cadence, show if due |
| `run-phase-changed` (→ continue-offer) | Prepare all 3 rewarded ads (Watch to Continue, Revive Shield, Score Doubler) |

### Storage Adapter

| Subscribe To | Action |
|-------------|--------|
| `high-score-beaten` | Persist new best to localStorage/IndexedDB |

### Analytics Adapter

| Subscribe To | Action |
|-------------|--------|
| `run-phase-changed` (→ game-over) | Fire run-complete event |
| `milestone-reached` | Fire milestone event |
| Any ad event (from AdAdapter) | Fire impression/revenue event |

---

## Versioning

This contract follows the spec version. Breaking changes (removing events,
changing payload shapes) require a spec amendment and a MAJOR version bump
per constitution governance rules.
