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
