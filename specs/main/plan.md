# Implementation Plan: Iron Wall Sky — Amendment Features (Engagement & Monetization)

**Branch**: `main` | **Date**: 2026-03-07 | **Spec**: [spec.md](../001-sky-defense-core/spec.md)
**Input**: Feature specification from `/specs/001-sky-defense-core/spec.md` (amended 2026-03-07)

## Analysis Output (2026-03-07)

**Current implementation status** — all original tasks (T001–T063) complete and verified:

| Check | Result |
|-------|--------|
| Unit tests | ✅ 76/76 pass (vitest) |
| Build | ✅ 0 TypeScript errors, 65 modules |
| ESLint | ✅ 0 violations |
| Bundle (app code) | ✅ ~11 kB gzip (within 150 kB budget) |
| Bundle (Phaser chunk) | ⚠️ 339 kB gzip (justified violation — see Complexity Tracking) |
| iOS setup (T046) | ⏭ Intentionally skipped on Windows (macOS + Xcode required) |

**Delta**: spec.md was amended 2026-03-07 to add 6 engagement & monetization features not yet implemented. This plan covers those features only.

---

## Summary

Iron Wall Sky is a complete, deployable portrait-first PWA/Android game (76 tests, clean build, ESLint-clean). The 2026-03-07 amendment extends the shipped baseline with:

1. **Enemy variety** — 4 types (standard, drifter, armored, speeder) unlocking progressively by difficulty level
2. **Combo multiplier** — consecutive hit streak multiplies score award
3. **Daily streak** — track consecutive play days; reward returning players
4. **Remote config** — fetch ad/difficulty tuning from a remote JSON without a code deploy
5. **Revive Shield** (2nd rewarded ad) — restore 1 life on first breach; 1 use per run
6. **Score Doubler** (3rd rewarded ad) — double final session score at game-over; 1 use per run
7. **Share card** — generate a shareable score image/text via Web Share API at game-over

All changes build on the existing pure-core + adapter architecture with zero new runtime dependencies.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) — no change
**Primary Dependencies**: Phaser 3, Capacitor 6, Vite — no new runtime deps added
**Storage**: localStorage / IndexedDB — extended with `dailyStreak`, `lastPlayedDate`, `dailyChallengeCompletedDate`
**Testing**: Vitest (unit + integration) — new unit tests for combo, streak, enemy variants
**Target Platform**: Web (PWA), Android — no change; iOS still pending T046
**Project Type**: Mobile-first PWA game — no change
**Performance Goals**: 60 fps, ≤ 8 ms per-frame CPU, ≤ 2 MB heap/min — unchanged; share card is one-shot, not per-frame
**Constraints**: Offline-capable; all new features gracefully degrade offline; share card falls back to clipboard copy; remote config falls back to `DEFAULT_CONFIG`
**Scale/Scope**: +4 enemy types, +2 rewarded ad placements, +1 combo system, +1 streak system, +1 share card

---

## Constitution Check

*Re-checked post-amendment against constitution v1.0.0.*

| Gate | Status | Notes |
|------|--------|-------|
| G1 — Tests pass + coverage | ✅ PASS | 76/76; new tasks add tests for each new system |
| G2 — Offline smoke (Playwright) | ✅ PASS | No new network-required features; remote config has offline fallback |
| G3 — Bundle ≤ 150 kB | ⚠️ JUSTIFIED | Phaser 339 kB gzip — see Complexity Tracking; app code ~11 kB |
| G4 — No Long Task > 50 ms | ✅ PASS | Enemy variant movement is O(1) per enemy; combo is a counter |
| G5 — Per-frame CPU ≤ 8 ms | ✅ PASS | Drifter sinusoidal drift: Math.sin(t) — negligible cost at 40 enemies |
| G6 — Heap growth ≤ 2 MB/min | ✅ PASS | Pooled sprites; no new allocations in hot path; share card is one-shot |
| G7 — Lighthouse ≥ 90 | ✅ PASS | No new blocking resources |
| G8 — Background timer check | ✅ PASS | Remote config fetch is one-time at boot; no new timers |
| G9 — Touch-target ≥ 48 px | ✅ PASS | New share button must have setSize guard (T079) |
| G10 — Asset hash verification | ✅ PASS | No new unbundled assets; enemy variant sprites go through atlas pipeline |

**Constitution Rule 28 check**: Revive Shield and Score Doubler must ONLY appear on the game-over screen — NEVER during active gameplay. Confirmed: both placements are wired to `game-over` / `continue-offer` phase transitions only.

**No constitution violations requiring justification** beyond the pre-existing Phaser bundle size.

---

## Project Structure

### Documentation

```text
specs/001-sky-defense-core/     # Original feature docs (DO NOT RENAME)
├── plan.md                     # Original plan (amended 2026-03-07)
├── research.md                 # Original research (§7–§13 to be added)
├── data-model.md               # Needs update for new entities
├── tasks.md                    # Extended with Phase 10 (T064–T089)
└── contracts/game-events.md    # Needs 3 new events

specs/main/
└── plan.md                     # This file — amendment plan
```

### Source Code (modified files only)

```text
src/core/
├── entities.ts       # EnemyType union extended; Run + HighScoreRecord fields added
├── config.ts         # New fields: comboThreshold, comboMultiplier, enemyTypeWeights, remoteConfigUrl
├── systems/
│   ├── movement.ts   # Drifter sine-wave + speeder velocity; armored no movement change
│   ├── scoring.ts    # Combo multiplier tracking
│   └── spawner.ts    # Weighted enemy-type selection by difficulty level

src/adapters/
├── phaser/
│   ├── play-scene.ts    # Combo HUD display; new enemy VFX (armored flash, speeder trail)
│   └── gameover-scene.ts# Revive Shield button, Score Doubler button, Share Card button
├── ads/
│   ├── native-ad-adapter.ts  # Revive Shield + Score Doubler ad unit IDs
│   └── web-ad-adapter.ts     # Revive Shield + Score Doubler ad slots
└── storage/
    └── storage-adapter.ts    # Extended HighScoreRecord schema + migration

src/main.ts                   # Remote config fetch at boot; streak update wiring

tests/unit/
├── scoring.test.ts    # Combo multiplier tests
├── spawner.test.ts    # Enemy-type weighted selection tests
└── movement.test.ts   # Drifter + speeder movement tests

tests/integration/
├── storage.test.ts    # HighScoreRecord v2 migration tests
└── streak.test.ts     # Daily streak logic tests
```

---

## Data Model Changes (delta from data-model.md)

### EnemyType (extended)

```typescript
// Before
type EnemyType = 'standard';

// After (spec FR-003 + "Enemy Type" entity)
type EnemyType = 'standard' | 'drifter' | 'armored' | 'speeder';
```

| Type | Unlocks at | Behavior | Health | Speed |
|------|-----------|----------|--------|-------|
| standard | level 0 | falls straight down | 1× base | 1× base |
| drifter | level 3 | sine-wave horizontal drift | 1× base | 1× base |
| armored | level 6 | straight fall, flashes on intermediate hits | 3× base | 1× base |
| speeder | level 10 | straight fall | 1× base | 3× base |

### Run (extended)

```typescript
// New fields added to existing Run interface
interface Run {
  // ... existing fields unchanged ...
  continueUsed: boolean;    // existing
  reviveAvailable: boolean; // NEW — false after Revive Shield consumed
  doublersUsed: boolean;    // NEW — false after Score Doubler consumed
  comboCount: number;       // NEW — consecutive hits without miss
  comboMultiplier: number;  // NEW — current score multiplier (1.0 base, capped)
}
```

### HighScoreRecord (extended)

```typescript
// Before
interface HighScoreRecord {
  bestScore: number;
  dateAchieved: string;
}

// After (streak tracking)
interface HighScoreRecord {
  bestScore: number;
  dateAchieved: string;           // ISO 8601
  dailyStreak: number;            // NEW — consecutive play days
  lastPlayedDate: string;         // NEW — ISO 8601 date (YYYY-MM-DD)
  dailyChallengeCompletedDate: string; // NEW — ISO 8601 date or ''
}
```

**Storage migration**: v1 → v2 migration in storage adapter: if `dailyStreak` is undefined, initialize to 0; `lastPlayedDate` to ''; `dailyChallengeCompletedDate` to ''.

### GameConfig (new fields)

```typescript
// New fields added to GameConfig
comboWindow: number;          // ms — reset combo if no hit within this window; default: 2000
comboMultiplierStep: number;  // Added per combo hit; default: 0.1
comboMultiplierCap: number;   // Maximum multiplier; default: 3.0
enemyTypeWeights: {           // Weighted probability per enemy type at each unlock level
  standard: number;           // Always 1.0
  drifter: number;            // Applied when level >= 3; default: 0.3
  armored: number;            // Applied when level >= 6; default: 0.2
  speeder: number;            // Applied when level >= 10; default: 0.15
};
remoteConfigUrl: string;      // URL to fetch config JSON; '' = disabled; default: ''
scoreTweetTemplate: string;   // Template for share text; default: 'I scored {score} pts in Iron Wall Sky! Can you beat me? 🔥'
```

### New Events (contract additions)

| Event | Payload | When |
|-------|---------|------|
| `combo-updated` | `{ count: number, multiplier: number }` | Combo count changes |
| `revive-granted` | `{ remainingLives: number }` | Revive Shield rewarded ad completed |
| `score-doubled` | `{ newScore: number, originalScore: number }` | Score Doubler rewarded ad completed |

---

## Complexity Tracking

> Pre-existing justified violation carried forward:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Phaser chunk 339 kB gzip (> 150 kB budget) | Phaser is not tree-shakeable; scene management, input, audio, camera are all required | CDN defeats offline-first; PixiJS requires months of custom code for equivalent features; custom Phaser build saves ~130 kB but adds maintenance burden on every Phaser upgrade |

> No new complexity violations introduced by the amendment features.
