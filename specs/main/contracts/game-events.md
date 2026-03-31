# Game Events Contract: Engagement & Monetization

**Date**: 2026-03-28

## New Events

### `streak-bonus-applied`

**Emitter**: `engine.ts` (in `step()` during `starting → playing`)
**Consumers**: `hud.ts` (streak bonus notification), `analytics-adapter.ts`

```typescript
interface StreakBonusAppliedEvent {
  bonus: number;   // Points awarded (100–1000)
  streak: number;  // Current daily streak count
}
```

**Trigger**: Once per run, on first `step()` call, when `dailyStreak > 1`.
**Invariant**: `bonus === Math.min(streak, 10) * 100`

### `streak-recovered`

**Emitter**: `engine.ts` (`recoverStreak()`)
**Consumers**: `gameover-scene.ts` (UI feedback), `analytics-adapter.ts`

```typescript
interface StreakRecoveredEvent {
  streak: number;  // The preserved streak count
}
```

**Trigger**: When player completes streak recovery rewarded ad.

## Modified Events

### `difficulty-increased` (existing — new consumer)

**New consumer**: `play-scene.ts` — shows "WAVE {level}" overlay text.
**Payload unchanged**: `{ level: number }`

### `enemy-spawned` (existing — new consumer behavior)

**New consumer behavior in `play-scene.ts`**:
- Apply tint based on `enemyType`: standard=none, drifter=0x4488ff, armored=0xffaa44, speeder=0xff4444
- If `enemyType === 'speeder'`: show red warning indicator at spawn x-position

**Payload unchanged**: `{ id, x, y, enemyType, health }`

## AdService Interface Extension

### `showBanner(): Promise<void>`

**Native**: Calls `AdMob.showBanner({ adId, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER })`.
**Web**: Creates a simulated banner DOM element or no-op.
**Error handling**: Logs warning, does not throw.

### `hideBanner(): Promise<void>`

**Native**: Calls `AdMob.hideBanner()`.
**Web**: Removes simulated banner DOM element or no-op.
**Error handling**: Logs warning, does not throw.

## Engine Command Extensions

### `grantBonusLife(): void`

**Precondition**: `run.phase === 'starting'`
**Effect**: `run.remainingLives = config.maxLives + 1; player.remainingLives = run.remainingLives`
**Event**: Emits `life-lost` with updated count (to sync HUD)

### `recoverStreak(): void`

**Precondition**: none (callable from any phase)
**Effect**: Sets `highScore.lastPlayedDate` to yesterday's date string
**Event**: Emits `streak-recovered` with `{ streak: highScore.dailyStreak }`
