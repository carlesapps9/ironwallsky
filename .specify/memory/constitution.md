<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial adoption)
  Modified principles: N/A (first version)
  Added sections:
    - Core Principles (9 principles: Deterministic Core, Explicit Game
      Loop & State Machine, Minimal Dependencies & Performance Budgets,
      Touch-First Portrait-First UX, Offline-First Reliability,
      Deterministic Testing & CI Gates, Ad Isolation, Zero-Editor Asset
      Pipeline, Minimal Ops & Failure-Tolerant Telemetry)
    - Definition of Done
    - CI Gate Checklist
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md        ✅ compatible (no update needed)
    - .specify/templates/spec-template.md         ✅ compatible (no update needed)
    - .specify/templates/tasks-template.md        ✅ compatible (no update needed)
    - .specify/templates/checklist-template.md    ✅ compatible (no update needed)
  Follow-up TODOs: none
-->

# IronwallSky Constitution

## Core Principles

### I. Deterministic Core

1. All gameplay logic (physics, scoring, collision, spawning, difficulty
   curves) MUST live in a pure, side-effect-free core module with no
   imports from rendering, input, audio, network, or ad SDKs.
2. The core MUST accept an injectable clock and an injectable RNG seed
   so that any session can be replayed or tested deterministically.
3. Rendering, input, audio, and ad integrations MUST be implemented as
   adapters that the core never references directly; adapters observe
   core state via a read-only view or event bus.
4. **Rationale**: Deterministic core enables reproducible tests, replay
   systems, and lets adapters be swapped (Canvas ↔ WebGL, Web Audio ↔
   silent) without touching game rules.

### II. Explicit Game Loop & State Machine

5. The game MUST use a single, explicit fixed-timestep game loop
   (`update(dt)` + `render(alpha)`) — no implicit framework ticks.
6. All screens and transitions MUST be modeled as a finite state machine
   (e.g., `Loading → Menu → Playing → GameOver → Menu`); every state
   transition MUST be logged and testable.
7. The loop MUST yield to the browser via `requestAnimationFrame` and
   MUST NOT schedule timers (`setInterval`/`setTimeout`) for gameplay.
8. **Rationale**: An explicit loop prevents hidden coupling, makes frame
   budgets measurable, and keeps lifecycle transitions predictable.

### III. Minimal Dependencies & Performance Budgets

9. Runtime dependencies MUST be zero or near-zero; any third-party
   library MUST be justified in a PR description and approved.
10. CI MUST enforce these budgets (fail the merge if exceeded):
    - Initial load (compressed): **≤ 150 kB** total transfer.
    - No Long Task > **50 ms** on a 4× CPU-throttled Lighthouse run.
    - Per-frame CPU: **≤ 8 ms** at 60 fps (measured via DevTools trace).
    - Heap growth per minute of gameplay: **≤ 2 MB** (no unbounded
      allocations).
    - Wake-lock and background timers: **zero** when the document is
      hidden (battery-friendly).
11. Bundle MUST be produced with tree-shaking and code-splitting; no
    barrel re-exports that defeat tree-shaking.
12. **Rationale**: A tiny bundle improves organic discoverability (Core
    Web Vitals), reduces churn on low-end devices, and keeps CI fast.

### IV. Touch-First, Portrait-First UX

13. The default and primary layout MUST be portrait orientation on
    mobile viewports (≥ 320 px width); landscape MUST NOT break but is
    not the design target.
14. All interactive elements MUST have a minimum touch target of
    **48 × 48 CSS px** with **≥ 8 px** spacing.
15. The game MUST provide instant retry (≤ 1 tap from Game Over to
    gameplay) with no mandatory interstitial between attempts.
16. All feedback (success, failure, scoring) MUST be conveyed visually
    (color, animation, screen-shake) so the game is fully playable
    when muted; audio is an enhancement, never the sole signal.
17. **Rationale**: The target audience plays one-handed on phones in
    public; every extra tap or audio dependency loses players.

### V. Offline-First Reliability

18. A service worker MUST precache the app shell and all critical
    assets on first visit; the game MUST be fully playable when
    offline or on flaky connections.
19. Caches MUST be versioned (e.g., `ironwallsky-v<hash>`); on deploy
    the new service worker MUST activate and prune stale caches.
20. If ads or analytics are unreachable the game MUST continue without
    error, log a warning, and retry silently on next natural break.
21. The app MUST register a Web App Manifest with appropriate icons,
    `display: standalone`, and `orientation: portrait`.
22. **Rationale**: Offline capability turns the PWA into a native-feel
    app, eliminates server dependency, and ensures gameplay is never
    gated on network.

### VI. Deterministic Testing & CI Gates

23. Unit tests for core gameplay MUST use a seeded RNG and an
    injectable simulated clock; no test may depend on wall-clock time
    or true randomness.
24. Integration tests MUST cover: touch input simulation, app
    lifecycle transitions (background → foreground, orientation
    change, visibility-hidden), and service-worker update flow.
25. CI MUST fail the merge if **any** of these conditions is true:
    - Test suite fails or coverage drops below threshold.
    - Offline smoke test fails (Puppeteer/Playwright with network
      disabled).
    - Bundle size exceeds budget (Principle III).
    - Lighthouse performance score drops below **90**.
26. All tests MUST run in < 60 s on CI; flaky tests MUST be
    quarantined immediately, not retried silently.
27. **Rationale**: Deterministic tests eliminate flakes, lifecycle
    tests prevent real-world crashes, and CI gates prevent silent
    regressions from reaching users.

### VII. Ad Isolation

28. Ad triggers MUST fire only at natural break points (game-over,
    level transition, voluntary "watch to continue") — never during
    active gameplay.
29. Ad code MUST load lazily and MUST NOT block the critical render
    path or the game loop; ad SDK scripts MUST be loaded with `async`
    or `defer` and MUST NOT be bundled with game code.
30. If the ad SDK fails to load, times out (> 5 s), or is blocked,
    the game MUST proceed normally; ad revenue is best-effort.
31. Ad frequency MUST be configurable via a remote config or local
    constant without a code change.
32. **Rationale**: Intrusive ads destroy retention; isolating ads
    protects core UX and ensures the game works even when ads are
    blocked.

### VIII. Zero-Editor Asset Pipeline

33. All assets (sprites, audio, fonts) MUST be processed by a CI
    script — no manual editor exports; source files live in a
    dedicated `assets-src/` directory.
34. The pipeline MUST: compress images (WebP/AVIF with PNG fallback),
    generate sprite atlases, hash filenames for cache-busting, and
    produce a manifest that the loader consumes.
35. Assets MUST be lazy-loaded by scene; only the boot scene's assets
    are included in the initial load budget (Principle III).
36. Cache invalidation MUST be automatic: hashed filenames +
    service-worker cache versioning; no manual cache-clear
    instructions.
37. **Rationale**: A scripted pipeline eliminates "works on my
    machine" art bugs, keeps CI reproducible, and guarantees optimal
    compression without manual steps.

### IX. Minimal Ops & Failure-Tolerant Telemetry

38. Core gameplay MUST require **zero** server-side infrastructure;
    the entire game MUST be deployable as static files to any CDN or
    static host.
39. Analytics and telemetry (e.g., play counts, retention events)
    are optional modules; they MUST use fire-and-forget requests and
    MUST NOT block, delay, or crash the game on failure.
40. Error reporting (e.g., Sentry) MUST be behind a feature flag and
    MUST NOT transmit PII; errors MUST be sampled (≤ 10 %) in
    production to control costs.
41. Deployments MUST be atomic (upload new files → update
    service-worker → old version still works until refresh).
42. **Rationale**: Static hosting is free/cheap, reduces attack
    surface, and means a single developer can ship and maintain the
    game indefinitely.

## Definition of Done

A feature or task is **done** when every item below is satisfied:

- [ ] Code compiles/bundles with zero warnings.
- [ ] All unit tests pass with seeded RNG and simulated clock.
- [ ] Integration tests for touch, lifecycle, and offline pass.
- [ ] Bundle size is within budget (≤ 150 kB compressed, excluding
      justified third-party chunks — see plan.md Complexity Tracking).
- [ ] No Long Task > 50 ms on throttled Lighthouse audit.
- [ ] Game is fully playable offline (service-worker smoke test).
- [ ] Game is fully playable with ads blocked.
- [ ] All interactive elements meet 48 × 48 px touch-target minimum.
- [ ] Visual-only feedback confirms every player action (no audio
      dependency).
- [ ] Ad triggers fire only at natural breaks; no mid-gameplay ads.
- [ ] Assets are pipeline-processed, hashed, and lazy-loaded.
- [ ] No new runtime dependency added without documented justification.
- [ ] PR passes all CI gates listed below.

## CI Gate Checklist

Every merge to the main branch MUST pass these gates:

| # | Gate | Threshold / Condition |
|---|------|-----------------------|
| G1 | Unit + integration tests | 100 % pass, coverage ≥ threshold |
| G2 | Offline smoke test | Puppeteer/Playwright, network disabled |
| G3 | Bundle size | ≤ 150 kB compressed total transfer |
| G4 | Long Tasks | None > 50 ms (4× CPU throttle) |
| G5 | Per-frame CPU | ≤ 8 ms at 60 fps |
| G6 | Heap growth | ≤ 2 MB / min of gameplay |
| G7 | Lighthouse perf score | ≥ 90 |
| G8 | No background timers | Zero wake-locks when `document.hidden` |
| G9 | Touch-target audit | All targets ≥ 48 × 48 CSS px |
| G10 | Asset hash verification | All assets hashed, manifest valid |

If **any** gate fails the PR MUST NOT be merged.

## Governance

1. This constitution supersedes all other project practices and
   conventions. Any conflict MUST be resolved in favor of the
   constitution.
2. **Amendments** require: (a) a PR updating this file,
   (b) rationale in the PR description, (c) version bump per
   Semantic Versioning (MAJOR for principle removal/redefinition,
   MINOR for new principle/section, PATCH for wording/clarification).
3. Every PR review MUST verify constitutional compliance; reviewers
   MUST cite the violated principle number when requesting changes.
4. Complexity above what the constitution prescribes MUST be justified
   in the PR description with a "Complexity Justification" section
   explaining why a simpler approach is insufficient.
5. Compliance reviews SHOULD occur quarterly or upon any MAJOR version
   bump to ensure the constitution still reflects project reality.

**Version**: 1.0.0 | **Ratified**: 2026-02-28 | **Last Amended**: 2026-02-28
