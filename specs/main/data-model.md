# Data Model: Playability, Engagement & Monetization Improvements

**Date**: 2026-03-28 | **Spec**: [specs/main/spec.md](spec.md)

## Entity Changes

### Run (modified — `src/core/entities.ts`)

Existing fields unchanged. New fields added:

```typescript
export interface Run {
  // ... existing fields ...

  /** Highest combo multiplier achieved this run; default: 1.0. */
  bestComboMultiplier: number;

  /** Whether streak recovery ad was shown this run. NOTE: The "once per session" guard
   *  from FR-MON-02 must be tracked via a module-level flag in the adapter (gameover-scene.ts),
   *  since Run resets per run. This field is retained for per-run deduplication. */
  streakRecoveryOffered: boolean;
}
```

**Defaults in `createRun()`**:
- `bestComboMultiplier: 1.0`
- `streakRecoveryOffered: false`

### HighScoreRecord (unchanged)

Already has all needed fields:
- `dailyStreak: number` — consecutive play days
- `lastPlayedDate: string` — ISO YYYY-MM-DD

No changes needed.

### GameConfig (unchanged for core)

Existing fields sufficient:
- `maxLives: 3` — used by `grantBonusLife()` as baseline
- `milestoneInterval: 500` — unchanged
- `comboMultiplierCap: 3.0` — unchanged

## New Engine Methods

### `grantBonusLife(): void`

```typescript
grantBonusLife(): void {
  if (state.run.phase !== 'starting') return;
  state.run.remainingLives = state.config.maxLives + 1;
  state.player.remainingLives = state.run.remainingLives;
  events.emit('life-lost', { remaining: state.run.remainingLives });
}
```

**Precondition**: Phase is `'starting'` (called after `startNewRun()`, before first `step()`).

### `recoverStreak(): void`

```typescript
recoverStreak(): void {
  const today = clock.getDateString();
  const todayMs = new Date(today).getTime();
  const yesterdayMs = todayMs - 86_400_000;
  const yesterday = new Date(yesterdayMs).toISOString().slice(0, 10);
  state.highScore.lastPlayedDate = yesterday;
  events.emit('streak-recovered', { streak: state.highScore.dailyStreak });
}
```

**Precondition**: Called when player completes the streak recovery rewarded ad.

### Streak Bonus (in `step()` transition)

```typescript
// Inside step(), when transitioning 'starting' → 'playing':
if (state.run.phase === 'starting') {
  transitionPhase('playing');
  // Streak bonus
  const streak = state.highScore.dailyStreak;
  if (streak > 1) {
    const bonus = Math.min(streak, 10) * 100;
    state.run.score += bonus;
    state.player.score = state.run.score;
    events.emit('score-changed', { score: state.run.score, delta: bonus });
    events.emit('streak-bonus-applied', { bonus, streak });
  }
}
```

## New Events

### `streak-bonus-applied`

```typescript
export interface StreakBonusAppliedEvent {
  bonus: number;   // Points added (e.g., 500)
  streak: number;  // Current streak count
}
```

Emitted once at run start when `dailyStreak > 1`.

### `streak-recovered`

```typescript
export interface StreakRecoveredEvent {
  streak: number;  // The preserved streak count
}
```

Emitted when `recoverStreak()` is called successfully.

## AdService Interface Changes

```typescript
export interface AdService {
  // ... existing methods ...

  /** Show a bottom banner ad (game-over screen). */
  showBanner(): Promise<void>;

  /** Hide the banner ad (when returning to gameplay). */
  hideBanner(): Promise<void>;
}
```

## State Transitions

No new phases. Existing FSM unchanged:

```
starting → playing → (continue-offer | game-over)
                ↑              |
                └──────────────┘ (via grantContinue/grantRevive)
```

`grantBonusLife()` is called during `starting` phase only.
`recoverStreak()` can be called from any phase (game-over screen context).

## Validation Rules

- Streak bonus: `streak > 1` AND `streak ≤ 10` cap on multiplier (not streak itself)
- Bonus life: Only in `'starting'` phase, only increases by 1 above maxLives
- Streak recovery: Only when `dailyStreak > 3` AND `lastPlayedDate` is not today or yesterday
- Banner ad: Must be hidden before transitioning to PlayScene
- `bestComboMultiplier`: Updated to `max(bestComboMultiplier, comboMultiplier)` in collision handling
