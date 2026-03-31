# Feature Spec: Playability, Engagement & Monetization Improvements

**Date**: 2026-03-28 | **Branch**: `main`

## Problem Statement

Iron Wall Sky has a solid core gameplay loop but lacks engagement hooks that drive repeat play and longer sessions. The monetization layer has only 3 rewarded ad placements and interstitials every 2 runs. Key retention data (daily streak) is tracked but never surfaced. Enemy types are visually indistinguishable. There is no banner ad revenue on idle screens. These gaps limit both player retention and revenue per user.

## Requirements

### Engagement

#### FR-ENG-01: Surface Daily Streak on Game-Over Screen

Display the player's current daily streak count on the game-over screen. The streak counter is already tracked and persisted in `HighScoreRecord.dailyStreak`. Show a streak badge (e.g., "🔥 5-day streak") below the score section. If streak is 0 or 1, show nothing.

#### FR-ENG-02: Streak Bonus Score

Award a per-run score bonus of `dailyStreak × 100` added to the player's score at run start (on first engine step transition to 'playing'). Display as a HUD notification: "+500 streak bonus". Capped at streak=10 (max bonus = +1000 points). The bonus counts toward displayed score and high score.

#### FR-ENG-03: Difficulty Wave Labels

When `difficulty-increased` event fires, display a brief centered HUD flash: "WAVE {level}" that fades after 1.5s. Uses existing event infrastructure — no engine changes needed.

#### FR-ENG-04: Session Stats on Game-Over

Extend the game-over screen to show: best combo achieved during the run, highest wave reached. Track `bestComboMultiplier` in the `Run` entity (updated when combo increases).

### Playability

#### FR-PLAY-01: Enemy Type Visual Differentiation

Apply distinct tints to enemy sprites based on `enemyType`:
- `standard`: no tint (default white)
- `drifter`: blue tint (0x4488ff)
- `armored`: orange tint (0xffaa44)
- `speeder`: red tint (0xff4444)

Applied at spawn time in PlayScene's `enemy-spawned` handler.

#### FR-PLAY-02: Speeder Spawn Warning

When a `speeder` enemy spawns, show a brief red flash indicator at the spawn x-position. The adapter shows a 300ms warning marker when a speeder-type `enemy-spawned` event is received, at the top of the screen at the enemy's x-position. The warning marker appears simultaneously with spawn; since the enemy starts at y=-32 (off-screen), the marker is visible ~300ms before the enemy enters the viewport.

#### FR-PLAY-03: Tap-to-Move Alternative Input

In addition to drag input, support single-tap positioning: when the player taps (pointerdown followed by pointerup within 150ms and <10px movement), the player character lerps to the tap x-position over 100ms. Does not replace drag — both inputs coexist.

### Monetization

#### FR-MON-01: Banner Ad on Game-Over Screen

Display a bottom banner ad on the game-over screen. Uses AdMob adaptive banner on native, simulated on web. If the banner fails to load, the game-over screen displays normally. The banner is hidden when transitioning to PlayScene.

#### FR-MON-02: Rewarded Ad for Streak Recovery

When `dailyStreak > 3` and the streak would reset (player missed a day — `lastPlayedDate` is not today and not yesterday), offer on the game-over screen: "🔥 Watch ad to save your {N}-day streak!". On rewarded ad completion, preserve the streak. Available once per session (tracked via a module-level flag in the adapter, not on Run — Run resets per run). Only shown when streak is at risk.

#### FR-MON-03: Optional Pre-Run Shield Ad

On the game-over screen, alongside the retry button, offer: "▶ Watch ad for extra life?" On completion, the next run starts with 4 lives instead of 3 (via `grantBonusLife()`). One-time per run. Does not appear on first ever run (runIndex === 0). Completely optional.

#### FR-MON-04: Banner Ad Unit Configuration

Add `VITE_ADMOB_BANNER_ANDROID` and `VITE_ADMOB_BANNER_IOS` environment variables. The `AdService` interface gains `showBanner(): Promise<void>` and `hideBanner(): Promise<void>` methods.

## Non-Functional Requirements

- NFR-01: All changes must pass existing CI gates (tests, lint, build, type-check).
- NFR-02: No new runtime dependencies. All features use existing Phaser 3 + Capacitor + AdMob stack.
- NFR-03: Core engine changes (Run entity fields, streak bonus) must have unit tests with seeded RNG.
- NFR-04: Ad placements must follow Constitution Principle VII (natural breaks only, never during gameplay).
- NFR-05: All visual feedback must work when muted (Constitution Principle IV.16).
- NFR-06: Banner ad must not overlap interactive elements or reduce touch targets below 48×48px.

## Out of Scope

- Persistent lifetime unlock progression (cosmetic ship skins) — separate feature.
- Powerup drops from enemies — separate feature, requires new entity types.
- Remote config A/B testing framework — separate feature.
- In-app purchases — project is ads-only per constitution.
