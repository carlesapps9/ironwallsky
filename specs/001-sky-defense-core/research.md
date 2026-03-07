# Research — Iron Wall Sky: Sky Defense Core

**Branch**: `001-sky-defense-core` | **Date**: 2026-02-28 | **Phase**: 0

---

## 1. Phaser 3 Bundle Size Reduction

**Decision**: Use Phaser's custom build entry point (`src/phaser-custom.js`)
to exclude unused modules — target ≤ 200 kB gzipped.

**Rationale**: Phaser 3 is **not tree-shakeable** via Vite/Rollup due to its
monolithic namespace pattern. The officially supported path is to copy the
custom entry file, comment out unused modules (Arcade Physics engine, Matter.js,
Tilemaps, Spine plugin, Facebook Instant Games), and build a custom ESM
bundle. Realistic savings: full Phaser 3.80+ is ~1 MB minified (~300 kB
gzipped); a custom build excluding the above drops to ~600–700 kB minified
(~180–210 kB gzipped).

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Load Phaser from CDN as external | Extra network request on first load; defeats offline-first; CDN dependency violates Principle IX |
| Replace Phaser with PixiJS | Loses scene management, input handling, asset loader, audio, camera — would need months of custom code |
| Phaser 3.80+ experimental ESM exports | Slightly better shaking but still not module-level granularity; too unstable for production |

**Risks & Mitigations**:

- **Maintenance**: Custom build must be re-created on every Phaser upgrade →
  pin Phaser version; upgrade deliberately, not automatically.
- **Silent failures**: Removing a module you later need fails at runtime →
  add integration test that boots the game and verifies core systems.
- **Dev server cold start**: Vite needs `optimizeDeps.include: ['phaser']`
  to pre-bundle Phaser; without it, cold start is slow.

---

## 2. Fixed-Timestep Game Loop

**Decision**: Implement a fixed-timestep accumulator in the Phaser Scene's
`update(time, delta)`. Core simulation runs in a pure-TS module via
`coreEngine.step(FIXED_DT)` inside a `while` loop. Phaser is the rAF
driver only.

**Rationale**: Phaser's default loop is variable-timestep. A fixed step
(e.g., 16.667 ms = 60 Hz) ensures deterministic behavior regardless of
device frame rate (30 fps phones still simulate at the same speed). The
core module has zero Phaser imports — it operates on plain numbers/arrays.
The Phaser scene reads core state and syncs sprites each frame.

**Pattern**:

```text
accumulator += delta
while accumulator >= FIXED_DT:
    coreEngine.step(FIXED_DT)
    accumulator -= FIXED_DT
alpha = accumulator / FIXED_DT  // optional render interpolation
```

**Risks & Mitigations**:

- **Spiral of death**: Cap accumulator at `FIXED_DT * 5` to prevent
  runaway simulation after tab-switch or long pause.
- **Phaser delta smoothing**: Disable `fps: { smoothStep: false }` in
  Phaser config to get raw deltas for the accumulator.
- **Precision loss**: Always work with `delta`, never raw `time` values.

---

## 3. Pixel-Perfect Collision

**Decision**: Two-phase collision — broad-phase AABB via Phaser's RBush
spatial index, narrow-phase pre-computed bitmask intersection.

**Rationale**: Phaser 3 has no native pixel-perfect collision. The two-phase
approach handles 40 enemies within the 8 ms frame budget:

1. **Broad phase**: AABB overlap check via Phaser's built-in Rectangle
   overlap or spatial tree reduces candidate pairs from O(n²) to ~5–15
   overlapping pairs per frame.
2. **Narrow phase**: At asset load time, render each sprite frame to an
   offscreen canvas, read pixel data via `getImageData()`, generate a
   1-bit-per-pixel collision mask as `Uint32Array`. At runtime, compute
   the overlap rectangle of two AABBs, then bitwise AND the masks. If any
   bit is set in both → collision confirmed.

**Performance**: A 64×64 overlap region = 4096 bit comparisons on
`Uint32Array` (128 AND operations). With 15 overlapping pairs per frame:
~1–2 ms total — well within budget.

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Polygon/SAT collision (PhysicsEditor) | Less accurate; extra tooling dependency |
| Matter.js physics bodies | ~200 kB extra; full physics sim unnecessary for detection-only |
| GPU stencil-buffer collision | Impractical without custom WebGL pipeline |

**Risks & Mitigations**:

- **CORS on `getImageData()`**: All sprites must be same-origin → ship
  assets locally via Vite; Capacitor bundles locally.
- **Animated sprites**: Need a mask per frame → 12 frames × 512 bytes =
  6 kB per entity; negligible.
- **Rotated/scaled sprites**: Mask coordinate transform is expensive →
  v1 sprites do NOT rotate; scale is uniform and applied to mask lookup.
- **Older Android WebView**: `getImageData()` may be slower due to
  GPU↔CPU readback → masks are pre-computed at load time, not per-frame.

---

## 4. Capacitor + Vite + Phaser Integration

**Decision**: Standard Capacitor 6 workflow — Vite builds to `dist/`,
Capacitor syncs to native projects via `npx cap sync`. Service worker
conditionally registered (web only, not Capacitor).

**Rationale**: Capacitor 6 has first-class Vite support. WebGL works on
both Android (Chrome WebView, WebGL 1/2) and iOS (WKWebView, WebGL 1/2
on iOS 15+). Capacitor serves from local HTTP server so standard web APIs
work.

**Platform-Specific Findings**:

| Concern | Android | iOS |
|---------|---------|-----|
| WebGL | Chrome WebView, universal GL1 support | WKWebView, GL1/2 on iOS 15+ |
| Service Worker | Works in Capacitor | **Does NOT work in WKWebView** — skip SW registration on native |
| Memory limit | No hard limit | **150 MB WKWebView hard-kill** — monitor textures |
| Audio unlock | User gesture required | User gesture required (stricter) |
| Safe area | Standard padding | Notch / Dynamic Island — use `env(safe-area-inset-*)` |

**Risks & Mitigations**:

- **iOS memory limit (150 MB)**: Texture atlases must be size-capped;
  monitor with `performance.memory` or native plugin.
- **Audio unlock**: Add a "Tap to Start" screen that triggers
  `AudioContext.resume()` via user gesture.
- **Samsung/Huawei WebGL bugs**: Set `failIfMajorPerformanceCaveat: false`
  and `type: Phaser.AUTO` (Canvas fallback).
- **Dev live reload**: Use `server: { url: 'http://LOCAL_IP:5173' }` in
  Capacitor config for dev; remove before shipping.

---

## 5. Object Pooling for Enemies & Projectiles

**Decision**: Use Phaser's built-in `Phaser.GameObjects.Group` with pooling
(`get()` / `killAndHide()` pattern). Pre-warm pools at scene start.

**Rationale**: Phaser Groups support max-size, create/remove callbacks, and
activation toggling. The `get(x, y, texture)` call retrieves an inactive
member or creates one if the pool isn't full. `killAndHide(sprite)` returns
it to the pool without GC. Pre-warming (e.g., 50 projectiles + 20 enemies)
eliminates runtime allocations entirely.

**Best Practices**:

1. Pre-warm pools at scene `create()` — allocate all objects, immediately
   deactivate.
2. Never call `destroy()` on pooled objects — use `killAndHide()` +
   `disableBody(true, true)`.
3. No object literals in `update()` — pre-allocate reusable temp values.
4. Reset event listeners on recycle via `removeAllListeners()` or use
   `createCallback` for one-time setup only.
5. Pool only sprites sharing the same texture atlas to avoid wasting VRAM.

**Heap Budget**: A well-pooled Phaser game should produce < 500 kB/min of
transient allocations (mostly Phaser internal events/matrices), well within
the 2 MB/min constitution budget.

---

## 6. Ad SDK Integration

**Decision**: Dual-strategy — native AdMob via `@capacitor-community/admob`
on Capacitor, web ads via Google Ad Manager / AdSense on browser PWA. Unified
`AdService` interface abstracts both.

**Rationale**: Native AdMob pays 3–10× higher CPMs than web ads on mobile.
Google's policy **prohibits** loading AdMob web ads inside a WebView — must
use native SDK via Capacitor plugin. Web ads serve the browser-only audience.

**Architecture**:

```text
AdService (interface)
├── NativeAdAdapter   → @capacitor-community/admob (Capacitor only)
└── WebAdAdapter      → Google Ad Manager GPT tag (browser only)

Platform detection: Capacitor.isNativePlatform()
Both adapters lazy-loaded via dynamic import() on first ad request.
```

**Compliance Requirements**:

| Requirement | Implementation |
|-------------|----------------|
| iOS ATT (App Tracking Transparency) | Call `AdMob.requestTrackingAuthorization()` before init on iOS 14.5+ |
| GDPR consent | Google UMP SDK via `@capacitor-community/admob` consent flow |
| Ad timing | Interstitial at game-over transition; rewarded on explicit player tap |
| Failure tolerance | Try/catch all ad calls; on failure, skip silently (FR-017) |

**Risks & Mitigations**:

- **iOS ATT rejection**: Without tracking consent, ad revenue drops ~30–40% →
  design consent UX to maximize opt-in rate.
- **Banner + canvas overlap**: Native banners render outside WebView →
  resize Phaser canvas via `game.scale.resize()` for banner height.
- **Ad mediation**: Consider AdMob mediation (Unity Ads, AppLovin) for
  better fill rates — native SDK path only.

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| Can Phaser be tree-shaken? | No — use custom build entry point |
| Target bundle size with custom Phaser? | ~180–210 kB gzipped (exceeds 150 kB budget; justified) |
| Fixed timestep in Phaser? | Accumulator in Scene.update(); core is pure TS |
| Pixel-perfect collision feasibility? | Pre-computed bitmasks + AABB broad phase; ~2 ms for 40 entities |
| Service worker on Capacitor iOS? | Does NOT work — skip registration; assets are local anyway |
| iOS memory constraint? | 150 MB hard limit on WKWebView — monitor textures |
| Ad SDK for native vs web? | Native: @capacitor-community/admob; Web: Google Ad Manager |
| AdMob web ads in WebView? | **Prohibited by Google policy** — must use native SDK |
| Rewarded ad placement during gameplay? | **Constitution Rule 28 violation** — all rewarded prompts moved to game-over screen (see §12) |
| Multiple rewarded placements per run? | Yes, if independently gated by separate boolean flags; FR-019 updated to enumerate three named placements |
| Remote config without server? | Static JSON on existing GitHub Pages host; fetch with AbortController timeout; silent-fallback |
| Drifter horizontal oscillation? | Per-frame `amplitude × sin(2π × freq × elapsedMs / 1000)` in movement.ts; `elapsedMs` added to Enemy entity |

---

## 7. Enemy Variety: Behavior Differentiation

**Amendment**: 2026-03-07

**Decision**: Four enemy types differentiated by movement pattern and stats, selection weighted by current difficulty level.

**Rationale**: A single enemy type makes runs predictable after a few plays. Progressive unlocking (type appears only above a difficulty threshold) ensures new mechanics are introduced when the player has already mastered the basics, avoiding tutorial overload. Weights are designed so the majority of enemies remain `standard` at all difficulty levels — new types are surprise introductions, not replacements.

| Type | Unlocks at level | Weight among active types | Stat modifiers | Movement |
|------|-----------------|--------------------------|----------------|----------|
| `standard` | 0 | Always majority | base | Straight down |
| `drifter` | 3 | 20 % | base | Sine-wave horizontal drift, `amplitude = worldWidth * 0.15`, `frequency = 0.4 Hz` |
| `armored` | 6 | 20 % | `health × 3` | Straight down |
| `speeder` | 10 | 20 % | `velocity.y × 3`, hitbox margin 8 px | Straight down |

**Drifter oscillation implementation**: `velocity.x = amplitude × sin(2π × frequency × enemy.elapsedMs / 1000)` computed in `movement.ts` each tick. Requires `elapsedMs: number` field on `Enemy` (incremented by dt each tick). Spawner sets initial `velocity.x = 0`; movement system owns all oscillation updates. This preserves core isolation — the spawner only configures constants; movement is stateless per-tick computation.

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Random behavior at any difficulty | Too chaotic early; damages learning curve |
| Additional EnemyType = `elite` boss variant | Scope creep for v1; requires balancing effort; deferred to future spec |
| Different projectile types per enemy | Adds bidirectional gameplay; inconsistent with "aim is always straight up" spec contract |

---

## 8. Combo Multiplier System

**Amendment**: 2026-03-07

**Decision**: Time-windowed streak multiplier. Steps: `[1×, 2×, 3×, 5×, 10×]`. Window: 1 500 ms reset on each kill. Breaks on window expiry or life-loss.

**Rationale**: Combo systems are the single most cost-effective engagement mechanic for score-chase games — they reward skilled positioning without requiring new input mechanics. A 1 500 ms window is long enough for deliberate play (rapid drag-and-position) but short enough that passive players won't maintain combos. The non-linear step sequence (`1→2→3→5→10`) front-loads feels of progress then delivers an outsized reward for long streaks, creating a visible asymmetric goal.

**Score consistency**: `scoreAwarded` is multiplied in `scoring.ts`; the base `scoreValue` per enemy is unchanged. `bestScore` comparison uses the post-multiplier score — multiplied scores ARE valid personal bests, which incentivizes combo maintenance over raw survival.

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Linear multiplier (1, 2, 3, 4, …) | Less satisfying; no "big jump" moment at 10× |
| Kill-count-only (no time window) | Trivially maintained; no skill differentiation |
| Multiplier resets only on life-loss | Too easy to maintain; reduces tension |

---

## 9. Daily Challenge & Streak

**Amendment**: 2026-03-07

**Decision**: Client-side daily challenge using date-derived RNG seed (`YYYYMMDD` as integer). Streak tracked with `lastPlayedDate` + `dailyChallengeCompletedDate` in `HighScoreRecord`.

**Rationale**: A daily challenge creates a daily return reason without any server infrastructure (Principle IX). The seed is derived from the current date — all players who play on the same calendar day receive the same enemy spawn sequence, enabling social comparison ("what score did you get today?"). The `dailyChallengeCompletedDate` guard prevents infinite replays on the same day, preserving the "special event" character.

**Streak logic** (in `storage-adapter.ts`):
- `lastPlayedDate === yesterday` → increment `dailyStreak`
- `lastPlayedDate === today` → no change (already counted)
- `lastPlayedDate` older or empty → reset `dailyStreak = 1`
- Always update `lastPlayedDate = today`

**Completion guard** (analysis finding M2): `dailyChallengeCompletedDate` is set when the player finishes a daily challenge run. At boot, if `dailyChallengeCompletedDate === today` the "DAILY CHALLENGE" banner is suppressed, showing "Challenge Complete" instead.

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Server-generated seed | Requires server infrastructure; violates Principle IX |
| Leaderboard for daily scores | Requires server + auth; out of scope for v1 |
| Weekly challenge (7-day seed) | Less return frequency; daily is the standard for mobile games |

---

## 10. Remote Config via Static JSON

**Amendment**: 2026-03-07

**Decision**: Fetch `docs/remote-config.json` served from GitHub Pages at boot. 3 s `AbortController` timeout. Shallow-merge into `DEFAULT_CONFIG`. Silent fallback on any failure.

**Rationale**: FR-020 requires ad cadence to be configurable without a code change. A static JSON file on the existing GitHub Pages host costs nothing and requires zero new infrastructure. The file is already served (GitHub Pages hosts `docs/`). The 3 s timeout is conservative — allow time for slow mobile connections while never blocking gameplay. Rate of access: one identical request per app launch, small file (~200 bytes), well within Pages rate limits.

**Fields exposed via remote config** (analysis finding L2):

```json
{
  "interstitialCadence": 2,
  "rewardedAdEnabled": true,
  "adTimeoutMs": 5000
}
```

**Deployment note**: Remote config JSON must be deployed and Pages must be live before the Android release. First boot will 404 and use defaults until Pages propagates (~5 min after push to `main`).

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Firebase Remote Config | Requires Firebase project, SDK (~40 kB), service account — violates Principle IX |
| localStorage-cached config | Cannot be updated without user clearing storage |
| URL query parameter flags | Exposes config to end users; not ergonomic for non-technical operators |

---

## 11. Share Card

**Amendment**: 2026-03-07

**Decision**: Offscreen `HTMLCanvasElement` (360 × 640 px) rendered in JavaScript. Web Share API (`navigator.share({ files })`) with `<a download>` web fallback. Native (Capacitor) path uses `@capacitor/filesystem` write + system share sheet.

**Rationale**: A native-quality share image drives organic distribution — the spec's US3 "clip-friendly" requirement. The Canvas API requires no external dependencies and works offline. Three environments require three paths (analysis finding M1):

| Environment | Strategy |
|-------------|----------|
| Web + Share API support | `navigator.share({ files: [pngBlob] })` |
| Web + no Share API | `<a href download>` temporary link + `click()` |
| Capacitor native (Android/iOS) | `Filesystem.writeFile()` to `Documents` + `Share.share({ url })` via `@capacitor/share` |

**`@capacitor/share` is already available** in the Capacitor ecosystem and does not add a new external dependency constraint — it is a first-party Capacitor plugin (peer dep of existing `@capacitor/core`). Must be added only to the native project, not bundled into web JS.

**Trigger conditions** (analysis finding L3): `peakCombo` is session-only (not persisted). The Share button appears when `high-score-beaten` fires OR `peakCombo > 5` at run end. This is intentionally transient — the share opportunity applies to the session's achievement.

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Third-party screenshot SDK | New dependency; violates Principle IX |
| Server-side OG image generation | Infrastructure; violates Principle IX |
| Clipboard copy of text score | Less visual; not share-worthy in feeds |

---

## 12. Three Rewarded Ad Placements — Constitutionality

**Amendment**: 2026-03-07 | Resolves analysis findings C1, C2, C3

**Decision**: Three named placements, all on the game-over screen, each gated by an independent boolean flag reset at run start.

**Constitutionality resolution (C1 — Rule 28)**:
The original design placed the Revive Shield prompt mid-gameplay (pulsing icon on defense line during active play). Rule 28 prohibits ad triggers during active gameplay. **Resolution**: The Revive Shield is now offered exclusively on the game-over screen. The trigger condition is `run.reviveAvailable === true AND this was the player's first life-loss (lives went from maxLives-1 to 0 on the lethal breach)`. This is detectable in the game-over scene via a new `wasFirstLifeLoss: boolean` field on the run-ended event. No mid-gameplay UI is required.

**Flag logic (C3 — corrected)**:

| Placement | Guard flag | Button shown when | Effect |
|-----------|-----------|------------------|--------|
| Watch to Continue | `continueUsed === false` | After any game over (if not used this run) | Resumes run with +1 life |
| Revive Shield | `reviveAvailable === true` | After game over caused by first life-loss | Restores run with lives reset to `maxLives - 1` |
| Score Doubler | `doublersUsed === false AND continueUsed === false` | After final game-over (no continue used) | Multiplies displayed score × 2 |

Three flags are *independent*. A player who used Revive Shield (setting `reviveAvailable = false`) can still access Watch to Continue on the next game over in the same run. A player who used Watch to Continue (`continueUsed = true`) cannot access Score Doubler on that game-over.

**FR-019 amendment (C2)**: The spec was updated to enumerate all three placements explicitly, removing the ambiguous "once per run" language and replacing it with three independently-gated named placements.

---

## 13. Difficulty Retuning — T032 vs ENG-002

**Amendment**: 2026-03-07 | Resolves analysis finding H3

**Decision**: ENG-002 values supersede T032 values. T032 was marked complete but the 45–120 s target was not independently verified with a measured profiling session before the amendment.

**Rationale**: The introduction of three new enemy types (particularly `speeder` at level 10 with 3× velocity) substantially changes the difficulty curve's effective ceiling. Even if T032 achieved the 45–120 s target with a single enemy type, adding a `speeder` that arrives 3× faster compresses the endgame significantly. ENG-002 retuning accounts for multi-type balancing:

| Config key | T032 value | ENG-002 value | Reason for change |
|------------|-----------|---------------|-------------------|
| `difficultyStepIntervalMs` | 8 000 ms | 5 000 ms | Faster ramp to expose new types sooner; `speeder` at level 10 needs to be reachable within 60 s |
| `maxDifficultyLevel` | 15 | 12 | Fewer levels needed when each level now changes both spawner weights AND enemy type; prevents over-ramp |
| `healthIncrementPerStep` | 0 | 1 | `armored` already has 3× base health; adding linear health growth on top provides late-game squeeze |
| `spawnRateMultiplierPerStep` | 0.92 | 0.88 | More aggressive ramp compensates for reduced level count |

**Verification requirement**: After implementing ENG-002, run 10 timed playtests at "average skill" (no deliberate positioning optimization). Median duration must be 45–120 s. If it falls below 45 s, increase `difficultyStepIntervalMs` or `spawnRateMultiplierPerStep`. If above 120 s, tighten further. Document results in a comment in `src/core/config.ts`.
