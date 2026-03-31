# Tasks: Playability, Engagement & Monetization Improvements

**Input**: Design documents from `/specs/main/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tests**: Required for core engine changes per NFR-03 ("Core engine changes must have unit tests with seeded RNG"). No additional test tasks beyond what NFR-03 mandates.

**Organization**: Tasks grouped by user story. All user stories depend on the Foundational phase but are otherwise independent of each other.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Environment variable configuration for banner ad units (FR-MON-04).

- [x] T001 Add `VITE_ADMOB_BANNER_ANDROID` and `VITE_ADMOB_BANNER_IOS` entries to .env.example with placeholder values per quickstart.md

**Checkpoint**: Environment configured — core implementation can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core engine entity changes, new engine methods, new event types, and AdService interface extension. All user stories depend on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `bestComboMultiplier: number` (default 1.0) and `streakRecoveryOffered: boolean` (default false) fields to `Run` interface and `createRun()` defaults in src/core/entities.ts
- [x] T003 [P] Add `StreakBonusAppliedEvent` (`bonus`, `streak`) and `StreakRecoveredEvent` (`streak`) interfaces, register `'streak-bonus-applied'` and `'streak-recovered'` in `GameEventType` union and `GameEventMap` in src/core/events.ts
- [x] T004 [P] Add `showBanner(): Promise<void>` and `hideBanner(): Promise<void>` to `AdService` interface and `createNoOpAdService()` stub in src/adapters/ads/ad-adapter.ts
- [x] T005 Implement streak bonus logic in starting→playing phase transition: `Math.min(dailyStreak, 10) * 100` added to score, emit `score-changed` and `streak-bonus-applied` events in src/core/engine.ts
- [x] T006 Implement `grantBonusLife()` method with `phase === 'starting'` guard that sets `remainingLives = maxLives + 1` and emits `life-lost` event in src/core/engine.ts
- [x] T007 Implement `recoverStreak()` method that sets `highScore.lastPlayedDate` to yesterday's date string and emits `streak-recovered` event in src/core/engine.ts
- [x] T008 [P] Update `bestComboMultiplier` to `Math.max(bestComboMultiplier, comboMultiplier)` when combo increases in src/core/systems/scoring.ts

**Checkpoint**: Foundation ready — all engine methods, entity fields, events, and interfaces are in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Streak Engagement System (Priority: P1) 🎯 MVP

**Goal**: Surface daily streak on game-over, award streak bonus at run start, and offer streak recovery via rewarded ad — driving daily return motivation.

**Independent Test**: Set `dailyStreak = 5` in localStorage → start run → see "+500 streak bonus" HUD notification → die → game-over shows "🔥 5-day streak" badge. Set `lastPlayedDate` to 3 days ago → game-over offers streak recovery ad.

**Requirements**: FR-ENG-01, FR-ENG-02, FR-MON-02 | NFR-03 (unit tests required)

### Tests for User Story 1 (NFR-03 required)

- [x] T009 [P] [US1] Add unit tests for streak bonus calculation (streak=0 no bonus, streak=2 → +200, streak=10 → +1000, streak=15 → capped at +1000) with seeded RNG in tests/unit/scoring.test.ts
- [x] T010 [P] [US1] Add unit tests for `grantBonusLife()` (phase guard, remainingLives = maxLives+1) and `bestComboMultiplier` tracking (updates on increase, ignores decrease) in tests/unit/engine.test.ts

### Implementation for User Story 1

- [x] T011 [US1] Show streak bonus HUD notification ("+{bonus} streak bonus") on `streak-bonus-applied` event, fade after 1.5s in src/adapters/phaser/hud.ts
- [x] T012 [US1] Display streak badge ("🔥 {N}-day streak") below score on game-over screen when `dailyStreak > 1` in src/adapters/phaser/gameover-scene.ts
- [x] T013 [US1] Implement streak recovery rewarded ad offer: show "Watch ad to save your {N}-day streak!" button when `dailyStreak > 3` and streak is at risk (lastPlayedDate not today/yesterday), guard with module-level session flag (not Run.streakRecoveryOffered — Run resets per run), call `recoverStreak()` on ad completion in src/adapters/phaser/gameover-scene.ts
- [x] T014 [US1] Add integration test for streak recovery flow (offer shown when streak at risk, hidden after use, recoverStreak preserves streak) in tests/integration/streak.test.ts

**Checkpoint**: Streak engagement fully functional — players see streak, get bonus, can recover streak via ad.

---

## Phase 4: User Story 2 — Banner Ad Monetization (Priority: P1)

**Goal**: Display adaptive banner ad on game-over screen for passive ad revenue on idle screens, hidden during gameplay.

**Independent Test**: Die → game-over screen shows banner at bottom (native) or simulated div (web) → tap retry → banner hidden before gameplay starts.

**Requirements**: FR-MON-01, FR-MON-04 | NFR-04 (natural breaks only), NFR-06 (no overlap)

### Implementation for User Story 2

- [x] T015 [P] [US2] Implement `showBanner()` (AdMob.showBanner with ADAPTIVE_BANNER, BOTTOM_CENTER, adId from env) and `hideBanner()` (AdMob.hideBanner) with try/catch logging in src/adapters/ads/native-ad-adapter.ts
- [x] T016 [P] [US2] Implement `showBanner()` (create positioned DOM div at bottom) and `hideBanner()` (remove DOM div) as web simulation in src/adapters/ads/web-ad-adapter.ts
- [x] T017 [US2] Call `adService.showBanner()` in game-over scene `create()` method in src/adapters/phaser/gameover-scene.ts
- [x] T018 [US2] Call `adService.hideBanner()` in play-scene `create()` method to clear banner on gameplay start in src/adapters/phaser/play-scene.ts

**Checkpoint**: Banner ad displays on game-over, hides on play — passive revenue active.

---

## Phase 5: User Story 3 — Visual Gameplay Clarity (Priority: P2)

**Goal**: Make enemy types visually distinguishable with color tints and warn players about fast-moving speeder enemies.

**Independent Test**: Play past wave 3 → drifters appear blue (0x4488ff); wave 6 → armored orange (0xffaa44); wave 10 → speeders red (0xff4444) with brief red flash warning at spawn position.

**Requirements**: FR-PLAY-01, FR-PLAY-02

### Implementation for User Story 3

- [x] T019 [US3] Apply enemy type tints in `enemy-spawned` handler: standard=no tint, drifter=0x4488ff, armored=0xffaa44, speeder=0xff4444 using `sprite.setTint()` at spawn time in src/adapters/phaser/play-scene.ts
- [x] T020 [US3] Add speeder spawn warning: on `enemy-spawned` with `enemyType === 'speeder'`, create red flash indicator at spawn x-position at top of screen, fade/destroy over 300ms in src/adapters/phaser/play-scene.ts

**Checkpoint**: Enemy types visually distinct — players can immediately recognize threat levels.

---

## Phase 6: User Story 4 — Session Feedback (Priority: P2)

**Goal**: Show wave progress during gameplay and session performance stats on game-over to help players understand their performance.

**Independent Test**: Play → difficulty increases → "WAVE {N}" flashes centered for 1.5s → die → game-over shows "Best Combo: x{N}" and "Wave: {N}" stats.

**Requirements**: FR-ENG-03, FR-ENG-04

### Implementation for User Story 4

- [x] T021 [P] [US4] Display "WAVE {level}" centered flash text on `difficulty-increased` event, fade after 1.5s using Phaser tween in src/adapters/phaser/play-scene.ts
- [x] T022 [US4] Show session stats on game-over screen: best combo multiplier (`run.bestComboMultiplier`) and highest wave reached (`run.currentDifficultyLevel`) below score section in src/adapters/phaser/gameover-scene.ts

**Checkpoint**: Players see wave progress and end-of-run stats — better performance awareness.

---

## Phase 7: User Story 5 — Tap-to-Move Input (Priority: P3)

**Goal**: Add tap-to-move as an alternative to drag input for improved accessibility and control options.

**Independent Test**: Tap (quick press <150ms, <10px movement) anywhere on screen → player character lerps to tap x-position over 100ms. Drag input still works as before.

**Requirements**: FR-PLAY-03

### Implementation for User Story 5

- [x] T023 [US5] Implement tap detection in pointerup handler: if `pointer.getDuration() < 150` and distance < 10px, lerp player sprite to `pointer.x` over 100ms using `this.tweens.add()`; coexists with existing drag handler in src/adapters/phaser/play-scene.ts

**Checkpoint**: Tap-to-move works alongside drag — both input methods coexist.

---

## Phase 8: User Story 6 — Pre-Run Extra Life Ad (Priority: P3)

**Goal**: Offer optional rewarded ad on game-over screen to start the next run with an extra life (4 lives instead of 3).

**Independent Test**: Complete a run (runIndex ≥ 1) → game-over shows "Watch ad for extra life?" button → complete ad → next run starts with 4 lives. Button not shown on first-ever run (runIndex === 0).

**Requirements**: FR-MON-03

### Implementation for User Story 6

- [x] T024 [US6] Add "Watch ad for extra life?" button on game-over screen, shown only when `runIndex > 0`, next to retry button (≥48×48px touch target) in src/adapters/phaser/gameover-scene.ts
- [x] T025 [US6] On extra life ad completion, call `engine.grantBonusLife()` after `startNewRun()` but before first `step()` to set remainingLives to maxLives+1 in src/adapters/phaser/gameover-scene.ts

**Checkpoint**: Optional extra life ad offering works — players can choose extra protection.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validate all NFRs and prepare for release.

- [x] T026 [P] Verify NFR-01: run full CI gate — `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build` all pass. Verify NFR-02: `npm ls --prod` shows no new runtime dependencies beyond Phaser 3 + Capacitor + AdMob
- [x] T027 [P] Verify NFR-04 and NFR-06: confirm all ad placements are at natural breaks (game-over only), banner does not overlap interactive elements or reduce touch targets below 48×48px; verify retry button at cy+220 has ≥50px clearance to adaptive banner (per R8)
- [x] T028 Run quickstart.md validation scenarios (streak bonus, enemy tints, wave labels, banner ad, streak recovery) and verify NFR-05 (all visual feedback works correctly when audio is muted)
- [x] T029 Version bump in package.json; `npx cap sync android` to sync native project

**Checkpoint**: All features validated, CI green, ready for release.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — **BLOCKS all user stories**
- **User Stories (Phases 3–8)**: All depend on Foundational (Phase 2) completion
  - User stories can proceed in parallel (if staffed) or sequentially in priority order
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 — Streak Engagement (P1)**: Depends on T002 (Run entity), T003 (events), T005/T007 (engine methods). No dependencies on other stories.
- **US2 — Banner Ad (P1)**: Depends on T004 (AdService interface). No dependencies on other stories.
- **US3 — Visual Clarity (P2)**: Depends on Phase 2 completion (no new entity/method needs). No dependencies on other stories.
- **US4 — Session Feedback (P2)**: Depends on T002 (bestComboMultiplier), T008 (combo tracking). No dependencies on other stories.
- **US5 — Tap-to-Move (P3)**: No Foundational dependencies beyond existing codebase. Independent.
- **US6 — Extra Life Ad (P3)**: Depends on T006 (grantBonusLife). No dependencies on other stories.

### Within Each User Story

- Tests (where included) → implementation tasks
- Models/entities before services
- Core logic before adapter/UI integration
- Each story independently testable at its checkpoint

### Parallel Opportunities

- T003, T004, T008 can all run in parallel (different files, no shared dependencies)
- T009, T010 can run in parallel (different test files)
- T015, T016 can run in parallel (different adapter files)
- T021 can run in parallel with T019 (different event handlers in play-scene.ts: `difficulty-increased` vs `enemy-spawned`)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — Streak Engagement
4. **STOP and VALIDATE**: Test streak bonus, badge, recovery independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (Streak Engagement) → Test → Deploy/Demo (MVP!)
3. Add US2 (Banner Ad) → Test → Deploy/Demo
4. Add US3 (Visual Clarity) + US4 (Session Feedback) → Test → Deploy/Demo
5. Add US5 (Tap-to-Move) + US6 (Extra Life Ad) → Test → Deploy/Demo
6. Polish phase → Final release

### Parallel Opportunities by Story

With multiple developers or parallel LLM agents:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Agent A: US1 (Streak Engagement) — touches hud.ts, gameover-scene.ts, streak.test.ts
   - Agent B: US2 (Banner Ad) — touches native-ad-adapter.ts, web-ad-adapter.ts
   - Agent C: US3 (Visual Clarity) — touches play-scene.ts enemy-spawned handler
3. After US1–US3 complete:
   - Agent A: US4 (Session Feedback) — touches play-scene.ts difficulty handler, gameover-scene.ts
   - Agent B: US5 (Tap-to-Move) — touches play-scene.ts input handler
   - Agent C: US6 (Extra Life Ad) — touches gameover-scene.ts

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- T019 and T020 are sequential (both modify the `enemy-spawned` handler in play-scene.ts)
