# Tasks: Engagement, Addiction & Monetization Improvements

**Branch**: `001-sky-defense-core` | **Date**: 2026-03-07
**Input**: Improvement plan (2026-03-07 conversation) validated by speckit.analyze
**Analysis findings resolved**: C1, C2, C3, H1, H2, H3, H4, M1, M2, M3, M4, L1, L3
**Prerequisites**: All tasks in `tasks.md` complete (T001–T063, core game loop, ads, storage, HUD, game-over scene all live)

**Scope**: Enemy variety (4 types), combo multiplier, daily challenge streak, difficulty
retuning, three distinct rewarded-ad placements (all on game-over screen per Constitution
Rule 28), remote config, share card.

## Format: `[ID] [P?] Description — file`

- **[P]**: Safe to run in parallel with other [P] tasks in the same phase (no shared file conflicts)
- Tasks without [P] must begin only after all [P] tasks in their phase are complete

---

## Phase A: Core Type & Config Extensions

**Purpose**: Extend shared types, config, and event contracts. All three tasks touch different
files with no cross-dependencies — run in parallel.

**⚠️ CRITICAL**: Phases B–E cannot begin until this entire phase is complete.

- [ ] **ENG-001** [P] Extend entity types — `src/core/entities.ts`:
  - Extend `EnemyType` union: `'standard' | 'drifter' | 'armored' | 'speeder'`
  - Add `elapsedMs: number` to `Enemy` (incremented each tick by movement.ts; used for drifter oscillation)
  - Add to `Run`:
    - `comboMultiplier: number` (default `1`)
    - `comboWindowRemaining: number` (ms, default `0`)
    - `comboStreak: number` (default `0`, count of consecutive kills)
    - `reviveAvailable: boolean` (default `true`; set `false` once used or offer dismissed)
    - `doublersUsed: boolean` (default `false`; set `true` after Score Doubler ad completes)
    - `wasFirstLifeLoss: boolean` (default `false`; set `true` when lives go from `maxLives-1 → 0` for the first time this run; used to gate Revive on game-over screen)
  - Add to `HighScoreRecord`:
    - `dailyStreak: number`
    - `lastPlayedDate: string` (ISO 8601 date only, `YYYY-MM-DD`)
    - `dailyChallengeCompletedDate: string` (ISO 8601 date only; empty string if never or not yet today)

- [ ] **ENG-002** [P] Tune difficulty constants and add feature flags — `src/core/config.ts`:
  - Update `DEFAULT_CONFIG` values (rationale documented in `research.md §13`):
    - `difficultyStepIntervalMs`: `8000 → 5000`
    - `maxDifficultyLevel`: `15 → 12`
    - `healthIncrementPerStep`: `0 → 1`
    - `spawnRateMultiplierPerStep`: `0.92 → 0.88`
  - Add to `GameConfig` interface and `DEFAULT_CONFIG`:
    - `dailyChallengeEnabled: boolean` (default `true`)
    - `comboWindowMs: number` (default `1500`)
    - `comboMultiplierSteps: number[]` (default `[1, 2, 3, 5, 10]`)
    - `remoteConfigUrl: string` (default `'https://carlesapps9.github.io/ironwallsky/remote-config.json'`)
  - Add a comment in `config.ts` after `DEFAULT_CONFIG` documenting the T032 supersession:
    > `// ENG-002 supersedes T032. Retuned for 4-enemy-type balance (research.md §13).`
    > `// After implementing ENG-002, run 10 timed playtests; median must be 45–120 s.`

- [ ] **ENG-003** [P] Add new event types — `src/core/events.ts`:
  - Add `ComboChangedEvent`: `{ multiplier: number; streak: number }`
  - Add `ReviveOfferedEvent`: removed — **no mid-gameplay event** (C1 fix; revive is gated in game-over scene, not emitted mid-run)
  - Add `DailyChallengeStartedEvent`: `{ seed: number; date: string }`
  - Add `EnemyHitEvent`: `{ id: EntityId; x: number; y: number; remainingHealth: number }` (emitted by collision system when enemy takes damage but is NOT destroyed; satisfies FR-013 for armored hit-flash — see ENG-017)
  - Register all three in `GameEventMap`

**Checkpoint**: `npx tsc --noEmit` passes with zero errors. Downstream phases can begin.

---

## Phase B: Core System Updates

**Purpose**: Update pure core systems and storage. All tasks touch different files — run in
parallel. All depend on Phase A completion.

**Dependencies**: ENG-001, ENG-002, ENG-003 must all be complete.

- [ ] **ENG-004** [P] Weighted enemy-type selection in spawner — `src/core/systems/spawner.ts`:
  - Add `selectEnemyType(level: number, rng: SeededRng): EnemyType` pure function using these weights:

    | Level range | `standard` | `drifter` | `armored` | `speeder` |
    |-------------|-----------|-----------|-----------|-----------|
    | 0–2         | 100 %     | 0 %       | 0 %       | 0 %       |
    | 3–5         | 80 %      | 20 %      | 0 %       | 0 %       |
    | 6–9         | 50 %      | 30 %      | 20 %      | 0 %       |
    | 10+         | 30 %      | 25 %      | 25 %      | 20 %      |

  - Set `enemy.enemyType` from `selectEnemyType`, then apply stat overrides:
    - `armored`: `enemy.health = baseHealth * 3`; `enemy.maxHealth = enemy.health`
    - `speeder`: `enemy.velocity.y = speed * 3`
    - `drifter`: `enemy.velocity.x = 0` (movement.ts owns oscillation); set no stat overrides
  - Initialize `enemy.elapsedMs = 0` on all enemy activations
  - Emit updated `enemy-spawned` event (already includes `enemyType`)

- [ ] **ENG-004b** [P] Drifter oscillation in movement system — `src/core/systems/movement.ts`:
  - After applying `velocity.y × dt` to all active enemies, add a conditional for `drifter`:
    ```
    if (enemy.enemyType === 'drifter') {
      const amplitude = state.config.worldWidth * 0.15;
      const frequencyHz = 0.4;
      enemy.velocity.x = amplitude * Math.sin(2 * Math.PI * frequencyHz * (enemy.elapsedMs / 1000));
    }
    enemy.elapsedMs += dt;
    ```
  - `enemy.elapsedMs` is incremented here for ALL enemy types (not just drifter) for future use
  - `velocity.x` for non-drifter types remains as set by the spawner (0 for standard/armored/speeder)

- [ ] **ENG-005** [P] Combo multiplier logic — `src/core/systems/scoring.ts`:
  - On `enemy-destroyed`:
    1. Reset `run.comboWindowRemaining = config.comboWindowMs`
    2. Increment `run.comboStreak`
    3. `multiplierIndex = Math.min(run.comboStreak - 1, config.comboMultiplierSteps.length - 1)`
    4. `run.comboMultiplier = config.comboMultiplierSteps[multiplierIndex]`
    5. `scoreAwarded = enemy.scoreValue * run.comboMultiplier`
    6. Emit `score-changed` and `combo-changed`
  - Each engine tick: decrement `run.comboWindowRemaining -= dt`:
    - When it reaches `<= 0`: reset `run.comboMultiplier = 1`, `run.comboStreak = 0`, emit `combo-changed { multiplier: 1, streak: 0 }`
  - On `life-lost`: reset `run.comboMultiplier = 1`, `run.comboStreak = 0`, `run.comboWindowRemaining = 0`, emit `combo-changed { multiplier: 1, streak: 0 }`
  - Note: Post-multiplier `scoreAwarded` is used for `bestScore` comparison — multiplied scores are valid personal bests

- [ ] **ENG-006** [P] Extend storage adapter — `src/adapters/storage/storage-adapter.ts`:
  - Persist `dailyStreak`, `lastPlayedDate`, `dailyChallengeCompletedDate` alongside `bestScore` on save
  - Load with safe fallbacks: `dailyStreak: 0`, `lastPlayedDate: ''`, `dailyChallengeCompletedDate: ''`
  - Add `updateStreak(today: string): void`:
    - `lastPlayedDate === yesterday` → `dailyStreak++`
    - `lastPlayedDate === today` → no change
    - otherwise → `dailyStreak = 1`
    - Always `lastPlayedDate = today`
  - Call `updateStreak(today)` during `load` at boot (`today = new Date().toISOString().slice(0, 10)`)
  - On run completion: if `dailyChallengeEnabled` and current run used today's challenge seed, set `dailyChallengeCompletedDate = today` and save

- [ ] **ENG-007** [P] Create static remote config — `docs/remote-config.json` (no code changes):
  ```json
  {
    "_comment": "Served from GitHub Pages. Edit here to tune ad cadence without an app update. See research.md §10.",
    "interstitialCadence": 2,
    "rewardedAdEnabled": true,
    "adTimeoutMs": 5000
  }
  ```

**Checkpoint**: `npm test` — update existing scoring and spawner test suites for new branches; all pass with zero regressions.

---

## Phase C: Ad Adapter Extensions

**Purpose**: Add Score Doubler and Revive Shield rewarded ad methods; wire remote config boot fetch.
ENG-008 and ENG-009 are independent files; ENG-010 only requires ENG-007.

**Dependencies**: ENG-001 (AdService type); ENG-007 (ENG-010 only).

- [ ] **ENG-008** [P] Add new rewarded methods to native adapter — `src/adapters/ads/native-ad-adapter.ts`:
  - Add `showScoreDoubler(): Promise<AdResult>` — uses `rewardedId`, same try/catch pattern as `showRewarded`
  - Add `showReviveShield(): Promise<AdResult>` — uses `rewardedId`, same try/catch pattern
  - Expose both on the returned `AdService` object
  - Update `AdService` interface in `src/adapters/ads/ad-adapter.ts` with both signatures

- [ ] **ENG-009** [P] Add stubs to web adapter — `src/adapters/ads/web-ad-adapter.ts`:
  - Implement `showScoreDoubler(): Promise<AdResult>` returning `'not-ready'`
  - Implement `showReviveShield(): Promise<AdResult>` returning `'not-ready'`
  - (Web build has no rewarded video in v1; stubs satisfy the `AdService` interface)

- [ ] **ENG-010** [P] Remote config boot fetch — `src/main.ts`:
  - After `DEFAULT_CONFIG` is composed but before `createGameState`:
    ```typescript
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const res = await fetch(config.remoteConfigUrl, { signal: controller.signal });
      if (res.ok) {
        const remote = await res.json();
        for (const key of ['interstitialCadence', 'rewardedAdEnabled', 'adTimeoutMs'] as const) {
          if (key in remote) (config as Record<string, unknown>)[key] = remote[key];
        }
        console.log('[Config] remote config loaded');
      }
    } catch {
      console.log('[Config] using defaults');
    }
    ```
  - Never `await` in a way that blocks the main render path if the config fetch hangs

**Checkpoint**: `npx tsc --noEmit` passes. `AdService` interface satisfied by both adapters on all four methods.

---

## Phase D: Phaser / UI Layer

**Purpose**: Surface new mechanics in scenes and HUD. ENG-011, ENG-013, ENG-017 can run in parallel; ENG-012 depends on all three.

**Dependencies**: Phases A, B, and C complete.

- [ ] **ENG-011** [P] Update HUD — `src/adapters/phaser/hud.ts`:
  - Subscribe to `combo-changed`: show a combo badge above the score (e.g., `×3`) with a brief
    scale-in tween when multiplier increases; hide badge when `multiplier === 1`. Badge must be
    at least 48 × 48 px touch-safe size (display-only, not interactive).
  - Subscribe to `daily-challenge-started`: show a "DAILY CHALLENGE" banner at top of screen
    for 2 s; if `dailyChallengeCompletedDate === today` at boot, show "CHALLENGE COMPLETE ✓"
    banner instead and suppress the challenge run from starting.
  - **No Revive prompt in HUD** (C1 fix: revive is handled solely on the game-over screen).

- [ ] **ENG-013** [P] Share card utility — `src/adapters/phaser/share-card.ts`:
  - Export `generateShareCard(run: Run, bestScore: number): Promise<void>`
  - Draw to offscreen `HTMLCanvasElement` (360 × 640 px): dark background, game title,
    final score, `bestScore` label if new record, peak combo this session, enemies destroyed, run time, today's date
  - Three-path share strategy (research.md §11):
    1. `navigator.canShare && navigator.share({ files: [pngBlob] })` — web with Share API
    2. `<a href={dataUrl} download="ironwallsky-score.png">` auto-clicked — web fallback
    3. Capacitor native: `Filesystem.writeFile()` to `Directory.Documents` then `Share.share({ url })` via `@capacitor/share`
  - Catch `NotAllowedError` (user dismissed) and all other errors silently with `console.warn`
  - `peakCombo` is **session-only** (not persisted); the share card reads it from the `run` object passed in

- [ ] **ENG-017** [P] New enemy type rendering + hit feedback — `src/adapters/phaser/play-scene.ts`:
  - In `enemy-spawned` handler: switch on `enemyType` to assign correct texture key:
    - `standard` → existing texture
    - `drifter` → `'enemy-drifter'` (sprite required in `assets-src/sprites/`)
    - `armored` → `'enemy-armored'` (sprite required; visual design: metallic/shielded look)
    - `speeder` → `'enemy-speeder'` (sprite required; visual design: elongated/aerodynamic)
  - Subscribe to `enemy-hit` (new event from ENG-003): trigger a white flash tween on the
    affected enemy sprite for 100 ms; for `armored` enemies additionally show a small health
    indicator (3 pips above the sprite, one removed per hit). This satisfies FR-013 visual
    feedback for multi-health enemies (analysis finding M3).
  - All new touch-target interactive elements (combo badge is display-only; no new inputs here)

- [ ] **ENG-012** Update game-over scene — `src/adapters/phaser/gameover-scene.ts`:

  **Three rewarded ad buttons — all on game-over screen (Rule 28 compliant):**

  1. **Revive Shield** (analysis C1 + C3 fix):
     - Show when: `run.reviveAvailable === true AND run.wasFirstLifeLoss === true`
     - Label: "Watch ad to revive (1 life)"
     - On ad completion: call `engine.grantContinue()` with lives restored to `maxLives - 1`;
       set `run.reviveAvailable = false`; hide button
     - On ad failure/skip: `reviveAvailable` remains `true` for one more attempt; hide button
       after second failed attempt
     - Gate is independent from `continueUsed` (C3 fix)

  2. **Watch to Continue** (existing, no logic change):
     - Show when: `run.continueUsed === false AND config.rewardedAdEnabled`
     - Guard condition is ONLY `continueUsed`; NOT gated on `reviveAvailable` (C3 fix)

  3. **Score Doubler**:
     - Show when: `run.doublersUsed === false AND run.continueUsed === false AND config.rewardedAdEnabled`
     - Label: "Watch ad to ×2 score"
     - On ad completion: set `run.displayScore = run.score * 2`; update score display in UI;
       set `run.doublersUsed = true`; hide button
     - `run.score` (used for `bestScore` comparison) is NOT modified — only `displayScore`
       (shown on screen) is doubled (M4 fix: two distinct fields)
     - Add `displayScore: number` to `Run` entity (initialized equal to `run.score` at run end;
       modified only by the doubler)

  **Share button**:
  - Track `peakCombo: number` in local scene state; update on each `combo-changed` event
  - Show Share button when `high-score-beaten` fires OR `peakCombo > 5` at run end
  - On tap: call `generateShareCard(run, bestScore)` from ENG-013
  - Share button must meet 48 × 48 px minimum

**Checkpoint**: Manual smoke test (see Verification Checklist). `npx tsc --noEmit` zero errors.

---

## Phase E: Tests

**Purpose**: Cover all new logic with deterministic unit/integration tests. All tasks
independent — run in parallel. Require Phases A and B complete only.

**Dependencies**: ENG-001, ENG-002, ENG-004, ENG-004b, ENG-005, ENG-006 must be complete.

- [ ] **ENG-014** [P] Combo multiplier tests — extend `tests/unit/scoring.test.ts`:
  - Multiplier steps through `[1, 2, 3, 5, 10]` on 5 consecutive rapid kills within window
  - 6th kill stays at `10×` (clamp at last step)
  - Multiplier resets to `1×` after `comboWindowMs` elapses with no kill (simulated clock)
  - Multiplier resets immediately to `1×` on `life-lost` event
  - `scoreAwarded` equals `enemy.scoreValue × multiplier` at each step
  - `combo-changed` fires with correct `{ multiplier, streak }` at each transition
  - Combo does NOT reset on difficulty-increased or enemy-spawned events

- [ ] **ENG-015** [P] Weighted enemy type tests — extend `tests/unit/spawner.test.ts`:
  - At level 0: 1 000 samples → 100 % `standard` (exact; no variance allowed)
  - At level 3: `drifter` in 15–25 % of 1 000 samples (seeded RNG for reproducibility)
  - At level 6: `armored` in 15–25 % of 1 000 samples; `drifter` in 25–35 %
  - At level 10: `speeder` in 15–25 %; `armored` in 20–30 %; `drifter` in 20–30 %
  - `armored` enemy health = `baseEnemyHealth * 3` (and `maxHealth` matches)
  - `speeder` enemy `velocity.y = baseSpeed * 3`
  - `drifter` initial `velocity.x === 0` (oscillation is movement.ts responsibility)
  - All enemy types initialize `elapsedMs === 0`
  - Add movement.ts drifter oscillation test: after 1 000 ms of ticks at `dt = 16`, `velocity.x`
    is non-zero and changes sign (confirms sin wave)

- [ ] **ENG-016** [P] Daily streak and completion guard tests — extend `tests/integration/storage.test.ts`:
  - `updateStreak('2026-03-07')` when `lastPlayedDate === '2026-03-06'` → `dailyStreak` increments
  - `updateStreak('2026-03-07')` when `lastPlayedDate === '2026-03-07'` → `dailyStreak` unchanged
  - `updateStreak('2026-03-07')` when `lastPlayedDate === '2026-03-05'` → `dailyStreak === 1`
  - `updateStreak('2026-03-07')` when `lastPlayedDate === ''` → `dailyStreak === 1`
  - After streak update, `lastPlayedDate === today` always
  - `dailyStreak`, `lastPlayedDate`, `dailyChallengeCompletedDate` round-trip through save → load
  - When `dailyChallengeCompletedDate === today`, challenge banner shows "Complete" (mock UI assertion)

**Checkpoint**: `npm test` — all new and existing tests pass. Zero regressions.

---

## Dependencies & Execution Order

### Phase Dependency Graph

```
Phase A: ENG-001 + ENG-002 + ENG-003          ← all [P], no dependencies
                     │
                     ▼
Phase B: ENG-004 + ENG-004b + ENG-005 + ENG-006     ENG-007 ← no deps, start any time
                     │                                    │
                     ▼                                    ▼
Phase C: ENG-008 + ENG-009              ENG-010 (needs ENG-007 only)
                     │
                     ▼
Phase D: ENG-011 + ENG-013 + ENG-017   ← all [P], then:
              ↓           ↓          ↓
         ENG-012 (sequential — needs ENG-011 + ENG-013 + ENG-017)

Phase E: ENG-014 + ENG-015 + ENG-016          ← all [P], start after Phase B
```

### Parallel Execution Table

| Phase | Run in parallel | Wait for |
|-------|----------------|----------|
| A | ENG-001, ENG-002, ENG-003 | nothing |
| B | ENG-004, ENG-004b, ENG-005, ENG-006, ENG-007 | Phase A (ENG-007 has no deps) |
| C | ENG-008, ENG-009, ENG-010 | Phase A + B (ENG-010 only needs ENG-007) |
| D | ENG-011, ENG-013, ENG-017 | Phase A + B + C |
| D | ENG-012 | ENG-011 + ENG-013 + ENG-017 |
| E | ENG-014, ENG-015, ENG-016 | Phase A + B |

### Fastest Path (maximum parallelism)

```
t=0  ENG-001 + ENG-002 + ENG-003 + ENG-007
t=1  ENG-004 + ENG-004b + ENG-005 + ENG-006 + ENG-008 + ENG-009 + ENG-010
t=2  ENG-011 + ENG-013 + ENG-017 + ENG-014 + ENG-015 + ENG-016
t=3  ENG-012
```

---

## Verification Checklist

### Automated

- [ ] `npx tsc --noEmit` — zero errors after Phase A completes
- [ ] `npm test` — all existing tests pass after Phase B (no regressions in scoring/spawner/movement/storage)
- [ ] `npm test` — ENG-014, ENG-015, ENG-016 all pass after Phase E
- [ ] `npm run build` — zero TS errors; bundle delta vs baseline < 10 kB gzip (no new heavy deps)
- [ ] `npx eslint src/core/` — no Phaser or browser imports in core (constitution Principle I)

### Manual Smoke Tests

- [ ] **Enemy variety**: Reach difficulty level 3 → drifter appears with sine-wave drift; level 6 → armored appears and requires 3 shots; level 10 → speeder falls very fast
- [ ] **Armored hit-flash**: Fire at armored enemy — white flash on each non-lethal hit; health pips decrement; pip count matches remaining health
- [ ] **Combo badge**: Kill 3 enemies within 1.5 s → badge shows `×3`; wait 1.5 s without kill → badge disappears; kill then lose a life → badge vanishes immediately
- [ ] **No mid-gameplay revive prompt**: Lose a life during a run — NO pulsing shield or any interactive element appears on screen during play; run continues normally until game over
- [ ] **Revive Shield on game-over (first life-loss)**: Lose the first life and it causes game over → game-over screen shows Revive button; tap → rewarded ad; on completion run resumes with `maxLives - 1` lives
- [ ] **Revive Shield absent (second game over same run)**: After reviving, lose remaining lives → game-over screen does NOT show Revive button
- [ ] **Watch to Continue independent of Revive**: After using Revive (reviveAvailable = false), continue playing and get a second game over → Watch to Continue button IS still shown (if continueUsed = false)
- [ ] **Score Doubler**: Reach game over without using a continue → Score Doubler button appears; tap → ad plays → displayed score doubles in UI; `bestScore` in localStorage equals pre-doubler score
- [ ] **Share**: Beat high score → Share button appears; tap → OS share sheet opens with card image; in Capacitor native test that the system share sheet opens
- [ ] **Daily streak**: Set `lastPlayedDate` in localStorage to yesterday's date → on next boot, streak counter shown in UI is incremented
- [ ] **Daily challenge complete guard**: Set `dailyChallengeCompletedDate` to today in localStorage → on boot, banner shows "CHALLENGE COMPLETE" not "DAILY CHALLENGE"
- [ ] **Remote config**: Temporarily set `remoteConfigUrl` to `'https://invalid.invalid/'` → game boots normally; console shows `[Config] using defaults`
- [ ] **Ads blocked**: Enable all ad blocking → all three rewarded buttons gracefully hide/show "unavailable"; no JS errors; game fully playable

---

## Analysis Findings Resolution Index

| Finding | Severity | Resolution | Task(s) |
|---------|----------|-----------|---------|
| C1: Revive mid-gameplay (Rule 28) | Critical | Revive moved entirely to game-over screen | ENG-011 (removed prompt), ENG-012 (added to game-over) |
| C2: FR-019 "once per run" ambiguous | Critical | FR-019 rewritten in spec.md; three named placements | spec.md (done), ENG-003, ENG-012 |
| C3: Flag logic error (reviveAvailable gates continueUsed) | Critical | Three independent boolean flags; each gates only its own button | ENG-001 (added doublersUsed), ENG-012 (corrected logic) |
| H1: Drifter needs movement.ts update | High | New task ENG-004b; elapsedMs added to Enemy | ENG-001, ENG-004b |
| H2: Play-scene doesn't render new types | High | New task ENG-017 | ENG-017 |
| H3: ENG-002 conflicts with T032 | High | Documented supersession in research.md §13; rationale: 4-type balance | ENG-002 (comment added), research.md |
| H4: plan.md assumption contradicts new enemy types | High | plan.md + spec.md assumptions updated | (done in spec.md/plan.md) |
| M1: Share card native path undefined | Medium | @capacitor/share path specified in ENG-013 | ENG-013 |
| M2: Daily challenge replay possible | Medium | dailyChallengeCompletedDate field added | ENG-001, ENG-006, ENG-011 |
| M3: Armored hit feedback missing | Medium | enemy-hit event + hit-flash in ENG-017 | ENG-003 (event), ENG-017 (rendering) |
| M4: "session score" undefined; run.score ambiguous | Medium | displayScore field added to Run; two distinct score fields | ENG-001, ENG-012 |
| L1: Terminology inconsistency | Low | "rewarded ad" standardized in this file; AdMob API method name kept as-is in code |
| L3: peakCombo persistence undefined | Low | Documented as session-only; read from run object in share card | ENG-012, ENG-013 |

---

## Notes

- `[P]` denotes tasks with no shared file conflicts within the same phase — safe for parallel agents
- **ENG-007** (`remote-config.json`) has zero code dependencies — any agent can create it at time t=0
- **`wasFirstLifeLoss`** is detected in the engine when `remainingLives` transitions from 1 to 0 for the first time this run (`!run.continueUsed && !run.reviveAvailable` cannot be used as a proxy — the flag must be set at the breach event before `reviveAvailable` is read)
- **`displayScore`** is initialized to `run.score` at run end; modified only by the Score Doubler; used for UI display only. The `bestScore` comparison in `HighScoreRecord` always uses `run.score`
- **Constitution Rule 28 compliance**: No ad trigger fires during active gameplay. The Revive Shield prompt appears only after the lethal breach causes game over and the game-over screen renders
- **@capacitor/share**: First-party Capacitor plugin, peer dep of existing `@capacitor/core`. Add to native project only; do not bundle into web JS. No `npm install` required if Capacitor is already installed
- Difficulty constants in ENG-002 replace `DEFAULT_CONFIG` values only; the `GameConfig` interface fields are unchanged — no callers break
