# Implementation Plan: Playability, Engagement & Monetization Improvements

**Branch**: `main` | **Date**: 2026-03-28 | **Spec**: [specs/main/spec.md](../../specs/main/spec.md)
**Input**: Feature specification from `/specs/main/spec.md`

## Summary

Add engagement hooks (daily streak display, streak bonus score, wave labels, session stats), playability polish (enemy type tints, speeder warnings, tap-to-move), and new monetization placements (game-over banner ad, streak recovery rewarded ad, pre-run shield ad) to increase session length, repeat play, and revenue per user — all without adding complexity to the core drag-and-shoot loop.

## Technical Context

**Language/Version**: TypeScript 5.6, Vite 6.4.1
**Primary Dependencies**: Phaser 3.80 (renderer), Capacitor 6.2 (native bridge), @capacitor-community/admob 6.2.0 (ads)
**Storage**: localStorage + IndexedDB fallback (HighScoreRecord persistence)
**Testing**: Vitest (120 unit/integration tests), seeded RNG + injectable clock
**Target Platform**: Mobile browsers (PWA), Android via Capacitor, iOS via Capacitor
**Project Type**: Mobile game (hybrid web + native)
**Performance Goals**: 60 fps, ≤8ms per frame, ≤150kB initial load
**Constraints**: Offline-capable, zero server infrastructure, ads-only monetization
**Scale/Scope**: Single-developer project, ~3500 LOC, 2 game scenes + 1 boot scene

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Deterministic Core | ✅ PASS | Streak bonus + Run fields are pure engine state; no adapter imports in core |
| II | Explicit Game Loop & State Machine | ✅ PASS | No new states added; streak bonus applied in existing `starting→playing` transition |
| III | Minimal Dependencies & Performance Budgets | ✅ PASS | Zero new dependencies; tints use Phaser built-in `setTint()` |
| IV | Touch-First Portrait-First UX | ✅ PASS | Tap-to-move adds accessibility; all new buttons ≥48×48px; all visual-only feedback |
| V | Offline-First Reliability | ✅ PASS | All features work offline; banner ad degrades gracefully |
| VI | Deterministic Testing & CI Gates | ✅ PASS | New Run fields tested with seeded RNG; no wall-clock deps |
| VII | Ad Isolation | ✅ PASS | Banner on game-over only (idle screen); streak recovery + shield ad at natural breaks |
| VIII | Zero-Editor Asset Pipeline | ✅ PASS | No new assets; only tints on existing sprites |
| IX | Minimal Ops & Failure-Tolerant Telemetry | ✅ PASS | No server infrastructure; ads fire-and-forget |

**Gate result: ALL PASS** — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (game events contract)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── engine.ts          # Streak bonus grant, bonus life support
│   ├── entities.ts        # Run entity: bestComboMultiplier, streakRecoveryOffered
│   ├── events.ts          # streak-bonus-applied event, streak-recovered event
│   └── systems/
│       ├── scoring.ts     # bestComboMultiplier tracking
│       └── spawner.ts     # (unchanged — warning handled in adapter)
├── adapters/
│   ├── phaser/
│   │   ├── play-scene.ts  # Wave labels, enemy tints, speeder warning, tap input
│   │   ├── gameover-scene.ts  # Streak display, session stats, banner ad, streak recovery, shield ad
│   │   └── hud.ts         # Streak bonus notification
│   └── ads/
│       ├── ad-adapter.ts  # AdService: +showBanner(), +hideBanner()
│       ├── native-ad-adapter.ts  # Banner ad implementation
│       └── web-ad-adapter.ts     # Banner ad simulation

tests/
├── unit/
│   ├── scoring.test.ts    # Streak bonus tests
│   └── engine.test.ts     # Bonus life, bestCombo tracking
└── integration/
    └── streak.test.ts     # Streak recovery flow
```

**Structure Decision**: Follows existing adapter pattern. Pure game logic in `src/core/`, rendering/input/ads in `src/adapters/`. No new directories needed.

## Complexity Tracking

No constitution violations — no entries needed.
