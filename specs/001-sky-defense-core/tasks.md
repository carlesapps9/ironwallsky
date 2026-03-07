# Tasks: Iron Wall Sky — Sky Defense Core

**Input**: Design documents from `/specs/001-sky-defense-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/game-events.md, quickstart.md
**Amendment**: 2026-03-07 — spec.md amended to add enemy variety (4 types), combo multiplier,
daily streak, remote config, 2 new rewarded-ad placements (Revive Shield, Score Doubler), share card.
Amendment tasks are in Phase 10 (T064–T089). Plan: specs/main/plan.md.

**Tests**: Constitution Principle VI mandates unit tests (seeded RNG +
simulated clock) and integration tests (lifecycle, touch, offline). Original
tests are in Phase 9 (T053–T063). Amendment tests are in Phase 10G (T084–T089).

**Organization**: Tasks are grouped by user story (5 stories, P1–P5) to enable
independent implementation and testing of each story. Phase 10 implements
cross-cutting amendment features that extend US1–US5.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story (US1–US5) from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding, tooling, and configuration

- [x] T001 Create project directory structure per plan.md (src/core/, src/core/systems/, src/adapters/phaser/, src/adapters/audio/, src/adapters/ads/, src/adapters/storage/, src/adapters/analytics/, assets-src/sprites/, assets-src/audio/, assets-src/fonts/, public/icons/, public/assets/, tests/unit/, tests/integration/, tests/e2e/)
- [x] T002 Initialize npm project and install dependencies (phaser, @capacitor/core, @capacitor/cli, @capacitor-community/admob, typescript, vite, vite-plugin-pwa, vitest, @playwright/test) in package.json
- [x] T003 [P] Configure TypeScript strict mode with path aliases (@core/*, @adapters/*) in tsconfig.json
- [x] T004 [P] Configure Vite with PWA plugin, Phaser pre-bundle, manual chunks, and ES2022 target in vite.config.ts
- [x] T005 [P] Configure Capacitor (appId, appName, webDir) in capacitor.config.ts
- [x] T006 [P] Create shell HTML with viewport meta, portrait orientation, and canvas container in src/index.html
- [x] T007 [P] Configure ESLint with rule to forbid Phaser/browser API imports in src/core/** in eslint.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, event bus, config, and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 [P] Define all entity interfaces (Vec2, EntityId, EnemyType, Player, Projectile, Enemy, CollisionMask, Run, RunPhase, HighScoreRecord, GameState) per data-model.md in src/core/entities.ts
- [x] T009 [P] Define GameConfig and AdConfig interfaces with default values per data-model.md in src/core/config.ts
- [x] T010 [P] Implement seeded PRNG (mulberry32 or equivalent, injectable seed) per constitution Principle I in src/core/rng.ts
- [x] T011 [P] Define injectable clock interface (getCurrentTime, getDelta) per constitution Principle II in src/core/clock.ts
- [x] T012 [P] Implement typed event bus (GameEventBus, GameEventMap, all 12 event payloads, on/off/emit) per contracts/game-events.md in src/core/events.ts
- [x] T013 Define EngineCommands interface and createGameState factory function (imports entities + config, no logic yet) in src/core/engine.ts

**Checkpoint**: Foundation ready — all types, event bus, config, RNG, and clock are available. User story implementation can begin.

---

## Phase 3: User Story 1 — Core Gameplay Loop (Priority: P1) 🎯 MVP

**Goal**: Player slides horizontally by dragging, weapon auto-fires straight up, enemies fall from the sky, pixel-perfect collision, difficulty escalates, run ends when lives are depleted, game-over screen with score and 1-tap retry.

**Independent Test**: Launch the game, drag to move, observe auto-fire, position under falling enemies, survive until game over, see score, tap to retry — all without network, audio, or ads.

### Core Systems (all [P] — separate files, no cross-dependencies)

- [x] T014 [P] [US1] Implement movement system (apply velocity×dt to player, enemies, and projectiles; clamp player to world bounds; deactivate off-screen projectiles) in src/core/systems/movement.ts
- [x] T015 [P] [US1] Implement collision system (AABB broad-phase overlap check, bitmask narrow-phase pixel-perfect test per research.md §3, emit enemy-destroyed/projectile-deactivated events) in src/core/systems/collision.ts
- [x] T016 [P] [US1] Implement spawner system (spawn enemies at configurable interval from seeded RNG x-position, activate from pool, respect maxSimultaneousEnemies cap of 40, emit enemy-spawned) in src/core/systems/spawner.ts
- [x] T017 [P] [US1] Implement difficulty system (increment level on timer, scale spawn rate + enemy speed + enemy health per config multipliers, cap at maxDifficultyLevel, emit difficulty-increased) in src/core/systems/difficulty.ts
- [x] T018 [P] [US1] Implement scoring system (award points on enemy-destroyed, track score in Run, check milestone threshold, emit score-changed + milestone-reached) in src/core/systems/scoring.ts

### Engine

- [x] T019 [US1] Implement game engine with fixed-timestep accumulator loop (step all systems per FIXED_DT, RunPhase FSM transitions per data-model.md with transition logging per constitution rule 6, auto-fire cooldown, breach detection → life-lost, game-over trigger, accumulator cap for spiral-of-death prevention) in src/core/engine.ts

### Phaser Adapters

- [x] T020 [P] [US1] Implement sprite pool manager (Phaser Group with get/killAndHide pattern, pre-warm 50 projectiles + 20 enemies at scene create, texture swap on reuse, physics body reset) per research.md §5 in src/adapters/phaser/sprite-pool.ts
- [x] T021 [P] [US1] Implement boot scene (show loading indicator per FR-026, preload sprite atlas + placeholder assets, generate collision masks from sprite pixel data via getImageData, pass masks to core, transition to play scene) in src/adapters/phaser/boot-scene.ts
- [x] T022 [P] [US1] Implement HUD overlay (score text display, row of heart/shield life icons, update on score-changed and life-lost events) in src/adapters/phaser/hud.ts
- [x] T023 [US1] Implement play scene (subscribe to all gameplay events per contracts/game-events.md adapter guide, sync sprites to core state, handle touch/drag input → engine.setPlayerX, create HUD, activate sprite pools, fixed-timestep call to engine.step) in src/adapters/phaser/play-scene.ts
- [x] T024 [US1] Implement game-over scene (display final score, personal best, run duration, and enemies destroyed per FR-005; retry button per FR-006; subscribe to run-phase-changed and high-score-beaten; 1-tap retry calls engine.startNewRun; transition back to play scene) in src/adapters/phaser/gameover-scene.ts
- [x] T025 [US1] Create entry point (Phaser GameConfig with AUTO renderer + FIT scale + portrait 360×640 + smoothStep:false + pixelArt:true per quickstart.md, instantiate core engine, register boot/play/gameover scenes, wire adapters) in src/main.ts

**Checkpoint**: Core gameplay loop is fully functional. Player can drag to move, auto-fire destroys falling enemies, difficulty escalates, lives deplete on breach, game-over shows score with 1-tap retry. Playable without network, audio, or ads.

---

## Phase 4: User Story 2 — Offline & Installable Experience (Priority: P2)

**Goal**: Game is a PWA installable to home screen, fully playable offline after first visit, high scores persist across sessions via localStorage/IndexedDB.

**Independent Test**: Install PWA, enable airplane mode, open game, play full run, see persisted high score, close and reopen — all without network.

- [x] T026 [P] [US2] Implement storage adapter (read/write HighScoreRecord to localStorage with IndexedDB fallback, detect storage unavailability and warn per FR-027, expose load/save methods) in src/adapters/storage/storage-adapter.ts
- [x] T027 [P] [US2] Create PWA web app manifest (name, short_name, display:standalone, orientation:portrait, theme_color, background_color, icon references) in src/manifest.webmanifest
- [x] T028 [US2] Configure service worker via vite-plugin-pwa (workbox precache glob patterns for js/css/html/webp/png/mp3/ogg, autoUpdate register type, conditional skip on Capacitor native per research.md §4) in vite.config.ts + src/main.ts
- [x] T029 [US2] Wire storage adapter to game events (load high score on boot, subscribe to high-score-beaten → persist, handle network-loss gracefully per FR-011) in src/main.ts

**Checkpoint**: Game installs as PWA, works fully offline, high scores persist across sessions. No network dependency for gameplay.

---

## Phase 5: User Story 3 — Score Chasing & Clip-Friendly Runs (Priority: P3)

**Goal**: Milestone celebrations at configurable score intervals, enhanced game-over stats (duration, enemies destroyed, new record highlight), difficulty curve validated for 45–120s runs.

**Independent Test**: Play three consecutive runs, confirm 45–120s duration, verify milestone celebrations, confirm high score highlight on new record.

- [x] T030 [P] [US3] Add milestone celebration VFX (subscribe to milestone-reached event, trigger screen-wide text flash + particle burst, must be visible when muted per FR-013/FR-025) in src/adapters/phaser/play-scene.ts
- [x] T031 [P] [US3] Enhance game-over scene with new-record highlight animation (distinct color/animation on high-score-beaten per US3 acceptance scenario 3) in src/adapters/phaser/gameover-scene.ts
- [x] T032 [US3] Tune difficulty curve config values (spawn intervals, speed/health multipliers, level cap) to achieve 45–120s average run duration at moderate skill per FR-009 in src/core/config.ts

**Checkpoint**: Runs last 45–120s, milestones trigger visual celebrations, game-over screen shows full stats with record highlights. Clip-friendly content is achievable.

---

## Phase 6: User Story 4 — Ads-First Monetization (Priority: P4)

**Goal**: Dual-platform ad integration (native AdMob + web ads), interstitial every N runs at game-over, rewarded continue (1 per run), fully graceful degradation when ads blocked, configurable cadence.

**Independent Test**: Complete multiple runs, observe interstitial cadence, use "watch to continue," confirm retry never blocked by ad failure, confirm fully playable with ads blocked.

- [x] T033 [P] [US4] Define AdService interface (showInterstitial, showRewarded with completion/failure callbacks, initialize, platform detection via Capacitor.isNativePlatform) in src/adapters/ads/ad-adapter.ts
- [x] T034 [P] [US4] Implement native ad adapter (dynamic import @capacitor-community/admob, AdMob.initialize with requestTrackingAuthorization for iOS ATT, interstitial + rewarded video with test ad unit IDs, try/catch all calls per FR-017) in src/adapters/ads/native-ad-adapter.ts
- [x] T035 [P] [US4] Implement web ad adapter (lazy-inject Google Ad Manager GPT script tag, interstitial + rewarded slot via googletag API, DOM overlay above canvas, try/catch all calls per FR-017) in src/adapters/ads/web-ad-adapter.ts
- [x] T036 [US4] Implement interstitial cadence logic (track run counter, show interstitial every N runs per AdConfig.interstitialCadence at game-over transition, 5s timeout per FR-018, never block retry per FR-017) in src/adapters/ads/ad-adapter.ts
- [x] T037 [US4] Implement rewarded continue flow (show "Watch ad to continue" button on game-over when continueUsed===false and rewardedAdEnabled, on completion call engine.grantContinue, hide button after use, handle failure gracefully per FR-019) in src/adapters/phaser/gameover-scene.ts
- [x] T038 [P] [US4] Implement analytics adapter (fire-and-forget event tracking for ad impressions, fill rate, run-complete, milestone; silent failure per FR-021, no PII per constitution rule 40) in src/adapters/analytics/analytics-adapter.ts

**Checkpoint**: Ads show at natural breaks only, interstitial cadence is configurable, rewarded continue works once per run, game is fully playable with all ads blocked. Revenue tracking is active.

---

## Phase 7: User Story 5 — Visual & Audio Feedback (Priority: P5)

**Goal**: Every game event has clear visual feedback (fully playable muted), optional audio enhancement with mute toggle (default muted), background/foreground pause/resume with overlay.

**Independent Test**: Play full run muted — shoot, hit, breach, milestone, game-over all unambiguously communicated visually. Enable audio, verify SFX play. Background app, verify pause overlay appears.

- [x] T039 [P] [US5] Implement audio adapter (Web Audio API, mute toggle defaulting to muted per FR-014, stop all audio on document.hidden per FR-015, resume on foreground, user gesture unlock for iOS) in src/adapters/audio/audio-adapter.ts
- [x] T040 [P] [US5] Add muzzle flash VFX on projectile-fired event (visual flash at player position, visible when muted per FR-013) in src/adapters/phaser/play-scene.ts
- [x] T041 [P] [US5] Add enemy destruction animation + score pop-up on enemy-destroyed event (explosion sprite + floating score text at impact point) in src/adapters/phaser/play-scene.ts
- [x] T042 [P] [US5] Add screen shake + breach flash on enemy-breached event (camera shake + red overlay flash per US5 acceptance scenario 3) in src/adapters/phaser/play-scene.ts
- [x] T043 [US5] Implement pause overlay (detect document.hidden + orientation change per FR-022/FR-023, call engine.pauseRun, show "tap to continue" overlay, resume on tap + foreground) in src/adapters/phaser/play-scene.ts
- [x] T044 [US5] Wire audio adapter to game events (subscribe to projectile-fired→shoot SFX, enemy-destroyed→explosion SFX, enemy-breached→warning SFX, milestone-reached→celebration SFX, life-lost→damage SFX) in src/main.ts

**Checkpoint**: Game is fully playable muted with clear visual feedback for every event. Audio enhances when enabled. Pause/resume works on background/foreground and orientation changes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Platform packaging, asset pipeline, lint enforcement, bundle verification, and quickstart validation

- [x] T045 [P] Initialize Capacitor Android project and run first sync (npx cap add android, npx cap sync) in android/ — note: required `npm install @capacitor/android@^6.0.0` first (v6 to match core v6)
- [-] T046 [P] Initialize Capacitor iOS project and run first sync (npx cap add ios, npx cap sync) in ios/ — **DEFERRED: macOS + Xcode required; not executable on Windows dev/CI machine**
- [x] T047 [P] Create asset pipeline CI script (compress sprites to WebP/AVIF with PNG fallback per constitution rule 34, generate sprite atlas, hash filenames, produce asset manifest) in scripts/build-assets.ts
- [x] T048 [P] Verify ESLint core-isolation rule catches Phaser/browser imports in src/core/** and fix any violations in eslint.config.ts
- [x] T049 Bundle size audit (vite build, measure Phaser chunk + app chunk compressed sizes, document results vs 150 kB budget + justified violation) in vite.config.ts
- [x] T050 Run full quickstart.md validation cycle (npm install → npm run dev → npm run build → npm run preview → npx cap sync android) — all steps passed; build: 0 TS errors, app code ~20 kB gzip (within budget), Phaser chunk 339 kB gzip (justified violation per plan.md)
- [x] T051 [P] Audit all interactive elements (retry button, watch-ad button, mute toggle, play button) for 48×48 px touch-target compliance with ≥ 8 px spacing per FR-024 / CI gate G9 — PASS with 1 fix: mute toggle relocated from top-right (overlapped HUD hearts) to bottom-right corner (worldWidth-28, worldHeight-32); all 4 audited elements have explicit setSize(max(w,48),max(h,48)) guards; no play button exists (game auto-starts)
- [x] T052 [P] Configure CI pipeline with gates G1–G10 per constitution CI Gate Checklist (test pass + coverage, offline smoke test via Playwright, bundle size check, Long Task audit, per-frame CPU, heap growth, Lighthouse ≥ 90, background timer check, touch-target audit, asset hash verification) in .github/workflows/ci.yml or equivalent

---

## Phase 9: Tests (Constitution Mandate)

**Purpose**: Satisfy constitution Principle VI (rules 23–27) and Definition of Done items 2–3. Seeded RNG + simulated clock for deterministic core tests; lifecycle integration tests.

- [x] T053 [P] [US1] Unit tests for movement system (velocity application, world-bound clamping, off-screen deactivation) with seeded RNG + simulated clock in tests/unit/movement.test.ts
- [x] T054 [P] [US1] Unit tests for collision system (AABB broad-phase, bitmask narrow-phase, event emission) with fixed collision mask data in tests/unit/collision.test.ts
- [x] T055 [P] [US1] Unit tests for spawner system (spawn interval, pool activation, max-enemy cap, RNG positioning) in tests/unit/spawner.test.ts
- [x] T056 [P] [US1] Unit tests for difficulty system (level increment, multiplier scaling, max cap) in tests/unit/difficulty.test.ts
- [x] T057 [P] [US1] Unit tests for scoring system (point award, milestone detection, event emission) in tests/unit/scoring.test.ts
- [x] T058 [P] [US1] Unit tests for game engine (FSM transitions, fixed-timestep accumulator, auto-fire cooldown, breach → life-lost → game-over, spiral-of-death cap) in tests/unit/engine.test.ts
- [x] T059 [P] Unit tests for seeded PRNG (deterministic output, seed injection, sequence reproducibility) in tests/unit/rng.test.ts
- [x] T060 [P] [US2] Integration test for storage adapter (read/write HighScoreRecord, storage-unavailable fallback warning) in tests/integration/storage.test.ts
- [x] T061 [P] Integration test for app lifecycle (background → pause, foreground → resume overlay, orientation change → pause) in tests/integration/lifecycle.test.ts
- [x] T062 [P] Integration test for touch input (drag → setPlayerX, clamp to bounds) in tests/integration/touch.test.ts
- [x] T063 E2E offline smoke test (Playwright with network disabled: load cached game, play full run, verify score persistence) in tests/e2e/offline.spec.ts

**Checkpoint**: All constitution-mandated tests pass. CI gates G1–G2 satisfied.

---

## Phase 10: Amendment Features (Engagement & Monetization) — 2026-03-07

**Source**: plan.md Amendment 2026-03-07, validated via speckit.analyze against constitution
**Baseline**: All T001–T063 complete. 76/76 tests pass. Build clean. ESLint clean.
**Prerequisites**: All previous phases complete; no blocking dependencies on incomplete tasks

### 10A: Data Model Updates (BLOCKS all Phase 10 work below)

- [ ] T064 [P] [US1] Extend `EnemyType` union to `'standard' | 'drifter' | 'armored' | 'speeder'` and add `driftPhase: number` field to `Enemy` interface (used by drifter sine-wave) in `src/core/entities.ts`
- [ ] T065 [P] [US1] Extend `Run` interface with `reviveAvailable: boolean`, `doublersUsed: boolean`, `comboCount: number`, `comboMultiplier: number`, `comboLastHitElapsedMs: number`; update `createGameState` factory to initialize all new fields (`reviveAvailable: true`, `doublersUsed: false`, `comboCount: 0`, `comboMultiplier: 1.0`, `comboLastHitElapsedMs: 0`) in `src/core/entities.ts` + `src/core/engine.ts`
- [ ] T066 [P] [US3] Extend `HighScoreRecord` interface with `dailyStreak: number`, `lastPlayedDate: string`, `dailyChallengeCompletedDate: string`; extend `GameConfig` with `comboWindow`, `comboMultiplierStep`, `comboMultiplierCap`, `enemyTypeWeights`, `remoteConfigUrl`, `scoreTweetTemplate`, `driftAmplitude` (default: 80 px), `driftFrequency` (default: 1.5 Hz), `continueEnabled` (default: true), `reviveEnabled` (default: true), `doublerEnabled` (default: true); remove single `rewardedAdEnabled` — replaced by 3 flags above; update `DEFAULT_CONFIG` with `remoteConfigUrl: ''` (remote config disabled — see Notes), `scoreTweetTemplate: 'I scored {score} pts in Iron Wall Sky! Can you beat me? 🔥'` in `src/core/entities.ts` + `src/core/config.ts`
- [ ] T067 [P] [US1] Add 3 new events to `GameEventMap` (`combo-updated`, `revive-granted`, `score-doubled`) with typed payloads per plan.md data model, and export from event bus in `src/core/events.ts`

**Checkpoint**: All new types compile. Existing 76 tests still pass.

### 10B: Core Systems (all [P] — separate concerns, no cross-dependencies)

- [ ] T068 [P] [US1] Update movement system to handle `drifter` (apply `Math.sin(driftPhase) * driftAmplitude` to `velocity.x` each step; increment `driftPhase` by `FIXED_DT * driftFrequency`) and `speeder` (spawn with `velocity.y = baseEnemySpeed * 3`) variants; `armored` and `standard` require no movement change in `src/core/systems/movement.ts`
- [ ] T069 [P] [US1] Update spawner system to select enemy type via weighted probability based on current difficulty level: `standard` always eligible; `drifter` eligible at level ≥ 3; `armored` at level ≥ 6; `speeder` at level ≥ 10; weights from `config.enemyTypeWeights`; use seeded RNG in `src/core/systems/spawner.ts`
- [ ] T070 [P] [US3] Update scoring system to apply `comboMultiplier` to point award on `enemy-destroyed`; on each kill: increment `comboCount`, step up `comboMultiplier` (capped at `config.comboMultiplierCap`), reset `run.comboLastHitElapsedMs = 0`; each step: increment `run.comboLastHitElapsedMs += dt`; when `comboLastHitElapsedMs > config.comboWindow` reset combo to baseline (`comboCount = 0`, `comboMultiplier = 1.0`, `comboLastHitElapsedMs = 0`); emit `combo-updated`; **MUST use the per-step `dt` accumulator — NEVER `setTimeout` (constitution rule 7)** in `src/core/systems/scoring.ts`
- [ ] T071 [P] [US3] Implement daily streak logic in engine: on `run-phase-changed → game-over`, compare today's date (ISO 8601 YYYY-MM-DD) via injectable `clock.getDateString()` (NOT `new Date()` — Constitution Principle I forbids browser APIs in core; extend `Clock` interface with `getDateString(): string` in `src/core/clock.ts`) with `highScore.lastPlayedDate`; if consecutive day increment `dailyStreak`, if same day keep it, if gap > 1 day reset to 1; persist updated record; emit `high-score-beaten` if bestScore changed in `src/core/engine.ts`

### 10C: Phaser Adapters

- [ ] T072 [P] [US3] Add combo HUD element to play scene (subscribe to `combo-updated`; display `xN` multiplier text near score when `comboMultiplier > 1.0`; animate on change; hide at `comboMultiplier === 1.0`; visible when muted per FR-013) in `src/adapters/phaser/play-scene.ts`
- [ ] T073 [P] [US1] **[BLOCKED — awaiting sprite art]** Add enemy-variant VFX to play scene once per-type sprites are available in `assets-src/sprites/`; armored enemies: white tint flash on intermediate hit (health > 0); speeder enemies: motion-trail particle emitter; drifter enemies: distinct sprite texture swap; all visual-only, zero gameplay impact; unblock by adding sprites and removing this label in `src/adapters/phaser/play-scene.ts`
- [ ] T074 [US4] Add Revive Shield button to continue-offer scene: show when `run.phase === 'continue-offer'` and `run.reviveAvailable === true` (H1 fix: was incorrectly 'game-over'; FSM sends lives=0+continueUsed=false to 'continue-offer', not 'game-over'); on tap show rewarded ad; on completion call `engine.grantRevive()` → engine sets `remainingLives = 1, reviveAvailable = false`, transitions to `playing`; on failure/skip leave `reviveAvailable` unchanged for one more attempt; hide after consumed; must NEVER appear during active gameplay (Constitution Rule 28) in `src/adapters/phaser/gameover-scene.ts`
- [ ] T075 [US4] Add Score Doubler button to continue-offer scene: show when `run.phase === 'continue-offer'` and `run.doublersUsed === false`; on tap show rewarded ad; on completion call `engine.grantScoreDouble()` → engine doubles `run.score` (does NOT affect `bestScore` comparison used for `high-score-beaten` event), sets `doublersUsed = true`, emits `score-doubled`; update score display after doubling; on failure/skip leave `doublersUsed` unchanged in `src/adapters/phaser/gameover-scene.ts`
- [ ] T076 [US3] Add Share Card to continue-offer/game-over scene: show "Share Score" button when `run.phase === 'continue-offer'` or `'game-over'`; on tap construct share payload (`title: 'Iron Wall Sky'`, `text: config.scoreTweetTemplate` with `{score}` replaced, `url: window.location.href`); call `navigator.share(payload)` if available; fall back to `navigator.clipboard.writeText(text)` with "Copied!" toast if Web Share API unavailable; touch-target ≥ 48 px (FR-024); no PII shared (constitution rule 40) in `src/adapters/phaser/gameover-scene.ts`

### 10D: Storage, Remote Config & Analytics

- [ ] T077 [P] [US2] Update storage adapter to handle `HighScoreRecord` v2 schema: on read, if `dailyStreak` is undefined apply migration (set to 0, `lastPlayedDate` to '', `dailyChallengeCompletedDate` to '') before returning; persist all new fields on save; update integration tests to cover migration path in `src/adapters/storage/storage-adapter.ts`
- [ ] T078 [P] [US4] Add remote config fetch to boot: in `src/main.ts`, if `DEFAULT_CONFIG.remoteConfigUrl` is non-empty fetch config JSON at startup with a 3 s timeout; merge fetched values over `DEFAULT_CONFIG` (only known keys, validated by type guard); on failure/offline silently use `DEFAULT_CONFIG`; never block gameplay start on config fetch; log fetch result (success/failure) to console in `src/main.ts`
- [ ] T090 [P] [US4] Extend analytics adapter to track amendment events: subscribe to `revive-granted` (fire `ad_rewarded_complete` with `{placement: 'revive'}`), `score-doubled` (fire `ad_rewarded_complete` with `{placement: 'double', newScore}`), and share card taps (fire `share_card_tapped` with `{score, method: 'native'|'clipboard'}`); all fire-and-forget with silent failure per FR-021; no PII (constitution rule 40) in `src/adapters/analytics/analytics-adapter.ts`

### 10E: Native & Web Ad Adapters (2 new placements)

- [ ] T079 [P] [US4] Add Revive Shield (`revive`) and Score Doubler (`double`) ad unit support to native ad adapter: new `showRevive(onGranted, onFailed)` and `showDouble(onGranted, onFailed)` methods; use `AdMob.prepareRewardVideoAd` with dedicated test ad unit IDs; follow same try/catch isolation pattern as existing rewarded ad in `src/adapters/ads/native-ad-adapter.ts`
- [ ] T080 [P] [US4] Add Revive Shield and Score Doubler ad slot support to web ad adapter: new `showRevive` and `showDouble` methods; reuse DOM overlay pattern from existing rewarded slot; add distinct GPT slot names; same 5 s timeout + silent failure per FR-017 in `src/adapters/ads/web-ad-adapter.ts`
- [ ] T081 [P] [US4] Update `AdService` interface with `showRevive` and `showDouble` method signatures; migrate `AdConfig.rewardedAdEnabled` (single flag) → 3 independent per-placement flags: `continueEnabled`, `reviveEnabled`, `doublerEnabled` (all default: `true`); update ad-adapter factory to gate each placement by its own flag and wire `grantRevive` / `grantScoreDouble` callbacks; update all call-sites that referenced `rewardedAdEnabled`: Watch to Continue gate → `continueEnabled` (T037 implementation), Revive Shield gate → `reviveEnabled` (T074), Score Doubler gate → `doublerEnabled` (T075) in `src/adapters/ads/ad-adapter.ts`

### 10F: Engine Methods (Revive, Score Double & Gap Stubs)

- [ ] T082 [US4] Add `engine.grantRevive()` method: validate `run.phase === 'continue-offer'` and `run.reviveAvailable === true`; set `remainingLives = 1`, `reviveAvailable = false`; transition phase to `playing`; emit `revive-granted`; log state transition per constitution rule 6 in `src/core/engine.ts`
- [ ] T083 [US4] Add `engine.grantScoreDouble()` method: validate `run.phase === 'continue-offer'` and `run.doublersUsed === false`; double `run.score`; set `doublersUsed = true`; emit `score-doubled`; do NOT re-evaluate `bestScore` (doubling happens post-run, does not affect personal best) in `src/core/engine.ts`
- [ ] T091 [P] [US3] Add daily-challenge gap stub: insert a `// TODO(daily-challenge): dailyChallengeCompletedDate is persisted but no challenge mechanic is defined yet — implement when a future spec defines the trigger, validation, and reward` comment above the `highScore.dailyChallengeCompletedDate` reference added by T066 so the gap is visible to future implementers in `src/core/engine.ts`

### 10G: Tests (Amendment — Constitution Mandate)

- [ ] T084 [P] [US3] Unit tests for combo scoring: multiplier increments on consecutive hits, resets after `comboWindow` ms elapses with no hit, caps at `comboMultiplierCap`, emits `combo-updated` with correct payload in `tests/unit/scoring.test.ts` (extend existing file)
- [ ] T085 [P] [US1] Unit tests for weighted enemy-type spawner: at difficulty level < 3 only `standard` spawned; at level 3 `drifter` eligible; at level 6 `armored` eligible; at level 10 `speeder` eligible; weights produce correct distribution over 1000 spawns with fixed seed in `tests/unit/spawner.test.ts` (extend existing file)
- [ ] T086 [P] [US1] Unit tests for drifter + speeder movement: drifter `velocity.x` follows sine wave each step; speeder spawns at 3× base `velocity.y`; armored and standard unaffected in `tests/unit/movement.test.ts` (extend existing file)
- [ ] T087 [P] [US4] Unit tests for engine revive, score-double, and Retry-from-continue paths: (1) `grantRevive()` sets `remainingLives = 1`, `reviveAvailable = false`, transitions `continue-offer → playing`; (2) `grantScoreDouble()` doubles score, sets `doublersUsed = true`, does not touch `bestScore`; (3) both methods guard wrong-phase calls with no-op; (4) Retry tap from `continue-offer`: `startNewRun()` transitions `continue-offer → game-over` (final), confirming continue-offer cannot be re-entered for same run in `tests/unit/engine.test.ts` (extend existing file)
- [ ] T088 [P] [US2] Integration tests for storage adapter v2 migration: simulate v1 record (no streak fields) → read → assert migration applied; write v2 record → read → assert all fields preserved in `tests/integration/storage.test.ts` (extend existing file)
- [ ] T089 [P] [US3] Integration tests for daily streak: consecutive day increments streak; same-day re-play does not increment; gap > 1 day resets streak to 1; uses injected `clock.getDateString()` (not real `Date.now()`) in `tests/integration/streak.test.ts` (new file)
- [ ] T093 [P] Playwright gameplay smoke test: boot game → wait for play scene to be active → simulate 5 drag-touch events across screen width → wait 3 s → assert no uncaught JS errors, HUD score element visible, at least 1 `projectile-fired` event logged; run with `--headed=false` and `--timeout=15000` in `tests/e2e/gameplay.spec.ts` (new file)

**Checkpoint**: All 7 amendment feature groups implemented and tested (enemy variety, combo multiplier, daily streak, remote config disabled, Revive Shield, Score Doubler, analytics extensions). 76 + N new tests pass. Constitution gates G1–G10 still satisfied. Share card tested manually (Web Share API requires real browser). T073 remains blocked until per-type sprites are added to `assets-src/sprites/`.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup ──► Phase 2: Foundational ──► Phases 3–7: User Stories ──► Phase 8: Polish ──► Phase 9: Tests
                        │ (BLOCKS ALL)            │
                        ▼                          ▼
                   All user stories          Can proceed in
                   depend on this            priority order or
                                             in parallel
                                                  │
                                                  ▼
                                          Phase 10: Amendment
                                          (T064–T089, 2026-03-07)
                                          Depends on Phases 1–9 complete
```

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phases 3–7)**: All depend on Foundational completion
  - Can proceed sequentially in priority order (P1 → P2 → P3 → P4 → P5)
  - Or in parallel if team capacity allows
- **Polish (Phase 8)**: Depends on at least US1 (Phase 3) being complete
- **Tests (Phase 9)**: Unit tests can start after Phase 3; integration/E2E after Phase 4+; CI setup (T052) can start after Phase 1
- **Amendment (Phase 10)**: Depends on Phases 1–9 fully complete (all 76 baseline tests passing)
  - 10A (data model) MUST complete first — blocks all other Phase 10 groups
  - 10B–10F can run in parallel after 10A
  - 10G (tests) runs last after 10B–10F

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P2)**: Can start after Foundational — no dependencies on other stories (high score persistence is independent of gameplay)
- **US3 (P3)**: Depends on US1 (needs gameplay loop for milestone/celebration testing); can run in parallel with US2
- **US4 (P4)**: Depends on US1 (needs game-over scene for ad placement); can run in parallel with US2/US3
- **US5 (P5)**: Depends on US1 (needs gameplay events to attach VFX/audio); can run in parallel with US2/US3/US4

### Within Each User Story

- Core systems (marked [P]) before engine integration
- Engine before Phaser adapters
- Adapters before entry-point wiring
- Commit after each task or logical group

### Parallel Opportunities

Within each phase, tasks marked [P] can be executed simultaneously:

| Phase | Parallel Tasks | Sequential After |
|-------|---------------|-----------------|
| Setup | T003, T004, T005, T006, T007 | T001, T002 first |
| Foundational | T008, T009, T010, T011, T012 | T013 after all |
| US1 | T014, T015, T016, T017, T018 | T019 → T020, T021, T022 [P] → T023, T024 → T025 |
| US2 | T026, T027 | T028 → T029 |
| US3 | T030, T031 | T032 |
| US4 | T033, T034, T035 | T036 → T037; T038 [P] anytime |
| US5 | T039, T040, T041, T042 | T043 → T044 |
| Polish | T045, T046, T047, T048, T051, T052 | T049 → T050 |
| Tests | T053, T054, T055, T056, T057, T058, T059, T060, T061, T062 | T063 after all |
| Ph10-A | T064, T065, T066, T067 | all [P] within 10A; MUST complete before 10B–10G |
| Ph10-B | T068, T069, T070, T071 | after T064–T067 |
| Ph10-C | T072, T073 [P]; then T074, T075, T076 | T072/T073 parallel; T074–T076 sequential |
| Ph10-D | T077, T078, T090 | all [P] after T064–T067 |
| Ph10-E | T079, T080, T081 | T079/T080 [P] → T081 after both |
| Ph10-F | T082, T083, T091 | T082/T083 after T065; T091 [P] after T066 |
| Ph10-G | T084, T085, T086, T087, T088, T089, T093 | all [P]; after all 10B–10F complete |
---

## Parallel Example: User Story 1

```text
# 1. Launch all core systems in parallel (5 tasks, 5 different files):
T014: movement.ts    ─┐
T015: collision.ts    │
T016: spawner.ts      ├──► all [P], no cross-dependencies
T017: difficulty.ts   │
T018: scoring.ts     ─┘

# 2. Engine integrates all systems (sequential):
T019: engine.ts       ──► depends on T014–T018

# 3. Launch parallel adapter scaffolding (3 tasks, 3 files):
T020: sprite-pool.ts ─┐
T021: boot-scene.ts   ├──► all [P], no cross-dependencies
T022: hud.ts         ─┘

# 4. Play scene wires everything (sequential):
T023: play-scene.ts   ──► depends on T019, T020, T021, T022

# 5. Game-over scene (sequential):
T024: gameover-scene.ts ──► depends on T019

# 6. Entry point (sequential):
T025: main.ts          ──► depends on all above
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational **(CRITICAL — blocks all stories)**
3. Complete Phase 3: User Story 1 — Core Gameplay Loop
4. **STOP and VALIDATE**: Playable game with drag-to-move, auto-fire, enemies, scoring, game-over, retry
5. Deploy/demo if ready — this is the MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. **US1 → Core Gameplay Loop** → Test independently → Deploy (MVP!)
3. **US2 → Offline & Installable** → Test independently → Deploy (PWA!)
4. **US3 → Score Chasing** → Test independently → Deploy (engagement!)
5. **US4 → Ads Monetization** → Test independently → Deploy (revenue!)
6. **US5 → Visual & Audio Polish** → Test independently → Deploy (polish!)
7. **Phase 8 → Polish** → Final validation → Ship
8. **Phase 10 → Amendment (2026-03-07)**:
   - 10A data model first (blocks everything)
   - 10B–10F in parallel
   - 10G tests last
   - Re-validate: all 76 baseline + N new tests pass before deploy

Each story adds value without breaking previous stories.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Constitution DoD requires tests — Phase 9 satisfies rules 23–26; Phase 10G extends them
- Phaser bundle exceeds 150 kB budget (justified violation — see plan.md Complexity Tracking)
- Phase 10 amendment plan: specs/main/plan.md (data model delta, constitution re-check, new events)
- Real AdMob production ad unit IDs and account setup: specs/001-sky-defense-core/tasks-admob-production (run Phase A–B before submitting to Play Store / App Store)
- `remoteConfigUrl` is disabled (`''`) by decision; enable by setting the URL constant in `src/core/config.ts` and deploying a JSON file to a CDN
- T073 is blocked pending sprite art for drifter / armored / speeder variants in `assets-src/sprites/`
