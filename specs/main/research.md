# Research: Playability, Engagement & Monetization Improvements

**Date**: 2026-03-28 | **Spec**: [specs/main/spec.md](spec.md)

## R1: AdMob Banner Ad Integration in Capacitor

**Decision**: Use `@capacitor-community/admob` `BannerAd` API (already installed at v6.2.0).

**Rationale**: The project already depends on `@capacitor-community/admob@6.2.0` for interstitial and rewarded ads. Banner ads are supported via `AdMob.showBanner()` and `AdMob.hideBanner()` with `BannerAdOptions` (position, adId, adSize). No additional dependency needed.

**Alternatives considered**:
- Google Ad Manager GPT banner for web: Already have web adapter with simulated overlays. Web banner can be a simple DOM div positioned at bottom.
- Third-party banner SDK: Rejected — would add a dependency (Constitution Principle III).

**Implementation notes**:
- `BannerAdSize.ADAPTIVE_BANNER` for responsive sizing
- `BannerAdPosition.BOTTOM_CENTER` to avoid gameplay area overlap
- Call `showBanner()` in GameOverScene `create()`, `hideBanner()` in PlayScene `create()`
- On web: create a positioned DOM div with simulated content or skip

## R2: Daily Streak Bonus — Engine Integration Point

**Decision**: Apply streak bonus in the `starting → playing` phase transition inside `engine.step()`.

**Rationale**: The engine already transitions from `'starting'` to `'playing'` on the first `step()` call. This is the natural injection point for a one-time run bonus. The streak value is available from `state.highScore.dailyStreak`. The bonus is added to `state.run.score` and `state.player.score`, and a `score-changed` event is emitted so the HUD updates.

**Alternatives considered**:
- Apply in `startNewRun()`: Rejected — `startNewRun()` resets everything to zero; bonus must come after reset.
- Apply in adapter (PlayScene): Rejected — violates Constitution Principle I (gameplay logic in core).

**Cap**: `Math.min(dailyStreak, 10) * 100` = max +1000 bonus.

## R3: Tracking Best Combo and Highest Wave in Run

**Decision**: Add `bestComboMultiplier: number` to the `Run` interface in `entities.ts`. Use existing `currentDifficultyLevel` for wave display.

**Rationale**: `bestComboMultiplier` is updated in `collision.ts` whenever `comboMultiplier` increases beyond the current best. `currentDifficultyLevel` already tracks the wave — no new field needed for that.

**Alternatives considered**:
- Track in adapter only: Rejected — violates Constitution Principle I.
- Add separate `highestWave` field: Unnecessary — `currentDifficultyLevel` serves the same purpose.

## R4: Tap-to-Move vs Drag Coexistence

**Decision**: Detect tap vs drag in `pointerup` handler based on duration (<150ms) and distance (<10px).

**Rationale**: Phaser's input system provides `pointer.getDuration()` and distance between `downX/downY` and `upX/upY`. If both are small, treat as tap and lerp player to `pointer.x` using `this.tweens.add()` over 100ms. Existing drag handler in `pointermove` is unaffected.

**Alternatives considered**:
- Use Phaser's gesture plugin: Rejected — adds a dependency.
- Always lerp on pointerdown: Rejected — conflicts with drag behavior.

## R5: Speeder Spawn Warning Visual

**Decision**: Handle entirely in the adapter (PlayScene) when `enemy-spawned` event fires with `enemyType === 'speeder'`.

**Rationale**: No core engine change needed. The adapter creates a brief red triangle/arrow indicator at the top of the screen at the enemy's x-position, fading over 300ms. The speeder starts at y=-32 (above screen), so the warning is visible before the enemy enters the viewport.

**Alternatives considered**:
- New `enemy-spawn-warning` event from spawner: Over-engineering for a visual-only feature.
- Delay the actual spawn: Changes game mechanics (violates Constitution Principle I determinism).

## R6: Streak Recovery Logic

**Decision**: Add `recoverStreak()` method to engine that sets `lastPlayedDate` to yesterday's date string.

**Rationale**: The streak calculation happens in `engine.ts endRun()` using the injectable clock. For recovery: if the player watches the ad, `recoverStreak()` sets `lastPlayedDate` to yesterday so the existing streak logic in `endRun()` will increment rather than reset. This avoids changing the core streak algorithm.

**Alternatives considered**:
- Modify endRun() streak logic directly: Rejected — more complex, harder to test.
- Track recovery flag: Unnecessary — setting lastPlayedDate achieves the same effect cleanly.

## R7: Pre-Run Bonus Shield (Extra Life)

**Decision**: Add `grantBonusLife()` method to engine that sets `remainingLives = maxLives + 1` before the first step.

**Rationale**: Called after `startNewRun()` but before `step()`. The engine is in `'starting'` phase. Bumps both `run.remainingLives` and `player.remainingLives` by 1. Emits `life-lost` event with new count to update HUD heart icons.

**Alternatives considered**:
- Modify `createRun()` to accept initial lives: Complicates the pure factory.
- Pass flag to `startNewRun()`: Changes existing API contract for all callers.

## R8: Banner Ad Position and Layout Safety

**Decision**: AdMob native banners render as a native overlay outside the WebView. No Phaser layout changes needed.

**Rationale**: `@capacitor-community/admob` banner renders as a native Android/iOS view overlaid on top of the WebView. The game-over scene content is centered vertically with ~100px below the retry button. Adaptive banner is typically 50-60px. No overlap expected on standard devices.

**Risk mitigation**: On very small screens, the banner could overlap the retry button. The game-over scene already uses relative positioning from center — the retry button at cy+220 on a 640px canvas leaves 100px margin, sufficient for adaptive banners.
