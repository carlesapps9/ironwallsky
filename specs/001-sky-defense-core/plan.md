# Implementation Plan: Iron Wall Sky — Sky Defense Core

**Branch**: `001-sky-defense-core` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-sky-defense-core/spec.md`

## Summary

A minimal, portrait-first mobile defense game where enemies fall from the sky
and the player slides horizontally to position under them while a weapon auto-
fires straight up. Built with Phaser 3 + TypeScript + Vite, packaged for
Android/iOS via Capacitor, deployed as a static PWA. Ads-first monetization at
natural breaks only. Deterministic core logic separated from Phaser rendering
via adapter pattern. Offline-first with service worker. Short 45–120 s runs
optimized for organic sharing and rapid retry.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Phaser 3 (2D engine), Capacitor (native shell), Vite (bundler)
**Storage**: localStorage / IndexedDB (device-local high scores and config)
**Testing**: Vitest (unit, deterministic core), Playwright (optional E2E smoke + offline)
**Target Platform**: Web (PWA), Android (Google Play via Capacitor), iOS (App Store via Capacitor)
**Project Type**: Mobile-first PWA game
**Performance Goals**: 60 fps, ≤ 8 ms per-frame CPU, ≤ 2 MB heap growth/min
**Constraints**: Offline-capable, portrait-first, fully playable muted, fully playable ads-blocked
**Scale/Scope**: Single-screen game, 1 enemy type (v1), max 40 simultaneous enemies, 45–120 s runs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Rules | Status | Notes |
|---|-----------|-------|--------|-------|
| I | Deterministic Core | 1–4 | ✅ PASS | Core logic is pure TS; Phaser is an adapter |
| II | Explicit Game Loop | 5–8 | ✅ PASS w/ design | Phaser's loop used as rAF driver; fixed-timestep `update(dt)` called from Phaser scene `update()` — core owns the tick |
| III | Minimal Deps & Budgets | 9–12 | ⚠️ VIOLATION — JUSTIFIED | Phaser 3 (~300 kB gzipped) exceeds 150 kB budget; see Complexity Tracking |
| IV | Touch-First UX | 13–17 | ✅ PASS | Portrait default, 48 px targets, mute-safe, 1-tap retry |
| V | Offline-First | 18–22 | ✅ PASS | Vite PWA / manual SW; manifest with standalone + portrait |
| VI | Deterministic Testing | 23–27 | ✅ PASS | Vitest with seeded RNG + simulated clock; Playwright offline smoke |
| VII | Ad Isolation | 28–32 | ✅ PASS | Lazy-loaded ad adapter; never blocks core loop |
| VIII | Asset Pipeline | 33–37 | ✅ PASS | Vite hashes assets; CI script for compression + atlas; lazy-load by scene |
| IX | Minimal Ops | 38–42 | ✅ PASS | Static deploy; Capacitor bundles locally; analytics optional |

**Gate result**: PASS with 1 justified violation (Principle III — bundle size).

### Post-Design Re-evaluation (Phase 1 complete)

| # | Principle | Post-Design Status | Notes |
|---|-----------|-------------------|-------|
| I | Deterministic Core | ✅ CONFIRMED | `data-model.md` — all entities are plain TS interfaces; `GameState` owned by core; event bus is the only core→adapter channel |
| II | Explicit Game Loop | ✅ CONFIRMED | Fixed-timestep accumulator pattern validated in `research.md` §2; `RunPhase` FSM defined in `data-model.md` with all transitions |
| III | Minimal Deps & Budgets | ⚠️ VIOLATION STANDS | Research §1 confirms custom Phaser build targets ~180–210 kB gzipped; still exceeds 150 kB. Mitigation: code-split Phaser into its own chunk; lazy-load scenes |
| IV | Touch-First UX | ✅ CONFIRMED | `EngineCommands.setPlayerX()` for drag; 1-tap retry via `startNewRun()`; all events have visual payloads |
| V | Offline-First | ✅ CONFIRMED | `quickstart.md` — `vite-plugin-pwa` for web; Capacitor bundles locally; SW skipped on native (research §4: iOS WKWebView blocks SW) |
| VI | Deterministic Testing | ✅ CONFIRMED | `data-model.md` — `rngSeed` in `GameState`; injectable clock via `engine.step(dt)`; Vitest + seeded PRNG |
| VII | Ad Isolation | ✅ CONFIRMED | `contracts/game-events.md` — ad adapter subscribes to `run-phase-changed`; lazy-loaded; `AdConfig` separate from core |
| VIII | Asset Pipeline | ✅ CONFIRMED | `quickstart.md` — Vite hashes output; `assets-src/` for raw files; collision masks generated at load time (research §3) |
| IX | Minimal Ops | ✅ CONFIRMED | Static `dist/` deploy; analytics adapter fire-and-forget; no server infrastructure |

**Post-design gate result**: PASS — same 1 justified violation. No new violations introduced by Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/001-sky-defense-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── game-events.md   # Event bus contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── core/                  # Pure deterministic game logic (NO Phaser imports)
│   ├── engine.ts          # Fixed-timestep update loop, state machine
│   ├── entities.ts        # Player, Enemy, Projectile value types
│   ├── systems/           # ECS-style systems
│   │   ├── movement.ts
│   │   ├── collision.ts
│   │   ├── spawner.ts
│   │   ├── difficulty.ts
│   │   └── scoring.ts
│   ├── rng.ts             # Seeded PRNG (injectable)
│   ├── clock.ts           # Injectable clock interface
│   ├── config.ts          # Game constants (lives, fire-rate, difficulty, ad cadence)
│   └── events.ts          # Typed event bus (core → adapters)
├── adapters/              # Side-effectful integrations (import Phaser here)
│   ├── phaser/            # Phaser 3 rendering + input adapter
│   │   ├── boot-scene.ts
│   │   ├── play-scene.ts
│   │   ├── gameover-scene.ts
│   │   ├── hud.ts
│   │   └── sprite-pool.ts
│   ├── audio/             # Web Audio adapter (mute-safe)
│   │   └── audio-adapter.ts
│   ├── ads/               # Ad SDK adapter (lazy-loaded, failure-tolerant)
│   │   ├── ad-adapter.ts          # AdService interface + platform detection
│   │   ├── native-ad-adapter.ts   # @capacitor-community/admob (Capacitor)
│   │   └── web-ad-adapter.ts      # Google Ad Manager GPT (browser PWA)
│   ├── storage/           # localStorage / IndexedDB adapter
│   │   └── storage-adapter.ts
│   └── analytics/         # Optional, fire-and-forget
│       └── analytics-adapter.ts
├── sw.ts                  # Service worker (precache + versioned cache)
├── manifest.webmanifest   # PWA manifest (standalone, portrait)
├── main.ts                # Entry point — wires core + adapters + Phaser config
└── index.html             # Shell HTML

assets-src/                # Raw source assets (processed by CI pipeline)
├── sprites/
├── audio/
└── fonts/

public/                    # Vite static assets (processed output)
├── icons/
└── assets/                # Pipeline output (hashed sprites, atlases, audio)

tests/
├── unit/                  # Vitest — deterministic core tests
│   ├── engine.test.ts
│   ├── collision.test.ts
│   ├── spawner.test.ts
│   ├── difficulty.test.ts
│   ├── scoring.test.ts
│   └── rng.test.ts
├── integration/           # Vitest — adapter integration tests
│   ├── storage.test.ts
│   ├── lifecycle.test.ts
│   └── touch.test.ts
└── e2e/                   # Playwright — optional smoke tests
    ├── offline.spec.ts
    └── gameplay.spec.ts

scripts/                   # Build and CI scripts
└── build-assets.ts        # Asset pipeline: compress, atlas, hash, manifest

capacitor/                 # Capacitor native project config
├── android/
└── ios/
```

**Structure Decision**: Single-project layout with strict `src/core/` (pure)
vs `src/adapters/` (side-effectful) separation. Capacitor wraps the Vite
build output for native packaging. Constitution Principle I is enforced by
directory convention: `core/` must never import from `adapters/`, Phaser, or
any browser API.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle III rule 9: Phaser 3 is a major runtime dependency | Phaser provides battle-tested 2D rendering, sprite management, input handling, asset loading, and cross-browser WebGL/Canvas fallback — building these from scratch would take 10× longer and introduce more bugs | Custom Canvas renderer was considered but rejected: would need to reimplement sprite batching, atlas loading, input normalization, and device pixel ratio handling — all solved by Phaser |
| Principle III rule 10: Bundle size ~300 kB gzipped (exceeds 150 kB budget) | Phaser's tree-shakeable custom build can reduce to ~200 kB gzipped by excluding unused modules (3D, arcade physics, tilemaps, spine); further reduced via code-splitting so only boot scene loads initially | No lighter framework offers equivalent feature completeness for 2D games; raw Canvas API fits budget but lacks asset pipeline, input normalization, WebGL batching, and would require months of custom code |
